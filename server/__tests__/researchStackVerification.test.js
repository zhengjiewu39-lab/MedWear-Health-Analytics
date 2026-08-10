const { describe, test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

// --- 1. ONNX loading & tensor conversion (engine → onnxInference) ---

describe('ONNX inference (engine.js + onnxInference.js)', () => {
  test('medwear_rf.onnx artifact exists with 17 feature meta', () => {
    const metaPath = path.join(__dirname, '../ai/models/medwear_rf.meta.json');
    const onnxPath = path.join(__dirname, '../ai/models/medwear_rf.onnx');
    assert.ok(fs.existsSync(onnxPath), 'ONNX model file missing — run npm run experiment:train');
    assert.ok(fs.existsSync(metaPath));
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    assert.equal(meta.feature_cols.length, 17);
    assert.deepEqual(meta.label_classes.sort(), ['high', 'low', 'moderate']);
  });

  test('loadModel + featuresToTensor produces [1,17] float32 tensor', async () => {
    const { loadModel, isModelLoaded, getModelInfo } = require('../ai/onnxInference');
    const { FEATURE_NAMES, extractFeatures } = require('../services/extractFeatures');
    const ort = require('onnxruntime-node');

    const ok = await loadModel('medwear_rf');
    assert.ok(ok, 'loadModel failed');
    assert.ok(isModelLoaded());
    assert.equal(getModelInfo().featureCount, 17);

    const features = extractFeatures({
      days: {
        '2026-01-01': {
          steps: 8000,
          heartRate: [72, 74, 76],
          spo2: [97, 98],
          hrv: [45],
          restingHeartRate: 62,
          sleepMinutes: { deep: 90, rem: 100, light: 200, awake: 15 },
        },
      },
      targetDay: '2026-01-01',
    });

    const values = FEATURE_NAMES.map((k) => Number(features[k] ?? 0));
    const tensor = new ort.Tensor('float32', Float32Array.from(values), [1, values.length]);
    assert.equal(tensor.dims[0], 1);
    assert.equal(tensor.dims[1], 17);
    assert.equal(tensor.type, 'float32');
  });

  test('predictRisk returns onnx-runtime label from trained model', async () => {
    const { predictRisk, loadModel } = require('../ai/onnxInference');
    const { extractFeatures } = require('../services/extractFeatures');
    await loadModel('medwear_rf');

    const healthy = extractFeatures({
      days: {
        '2026-01-01': {
          steps: 9000,
          heartRate: [68, 70, 72],
          spo2: [97, 98],
          hrv: [50],
          restingHeartRate: 60,
          sleepMinutes: { deep: 90, rem: 100, light: 200, awake: 15 },
        },
      },
      targetDay: '2026-01-01',
    });
    const pred = await predictRisk(healthy);
    assert.equal(pred.engineType, 'onnx-runtime');
    assert.equal(pred.modelId, 'medwear_rf');
    assert.ok(['low', 'moderate', 'high'].includes(pred.label));
    assert.equal(pred.featureVector.length, 17);
  });

  test('runFullAnalysis wires store → extractFeatures → ONNX', async () => {
    const { runFullAnalysis } = require('../ai/engine');
    const store = {
      daily: {
        '2026-01-05': {
          steps: 8500,
          heartRate: [70, 72, 74],
          spo2: [97, 98],
          hrv: [48],
          restingHeartRate: 62,
          sleepMinutes: { deep: 80, rem: 90, light: 180, awake: 10 },
        },
      },
    };
    const result = await runFullAnalysis({
      store,
      diseaseScreening: {
        categories: [{ items: [{ name: '高血压', risk: 20, level: 'low' }] }],
        overallScore: 20,
        summary: 'test',
        dataCoverage: { quality: 90 },
      },
      stats: { heartRate: 72, steps: 8500 },
      profile: { name: 'Test' },
    });
    assert.equal(result.engineType, 'evidence-weighted-rule-engine');
    assert.equal(result.inferenceBackend, 'onnx-runtime');
    assert.ok(result.optionalOnnxPrediction);
    assert.equal(result.optionalOnnxPrediction.engineType, 'onnx-runtime');
    assert.ok(result.conditions.length > 0);
  });
});

// --- 2. MAD algorithm (analyticsCore → robustAnomaly) ---

describe('MAD robust Z-score (analyticsCore.js → robustAnomaly.js)', () => {
  test('robustZScore: |Z| > 2.5 flags outlier beyond median baseline', () => {
    const { robustZScore, median, mad } = require('../services/robustAnomaly');
    const baseline = [68, 70, 69, 71, 68, 70, 69, 71, 68, 70];
    const med = median(baseline);
    const scale = mad(baseline) * 1.4826;
    const spike = med + 3.5 * scale;
    const z = robustZScore(spike, baseline);
    assert.ok(z > 2.5, `expected Z > 2.5, got ${z}`);
    const normal = robustZScore(med + 0.5 * scale, baseline);
    assert.ok(Math.abs(normal) <= 2.5);
  });

  test('detectAnomaliesFromStore uses MAD not 2σ mean/std', () => {
    const { detectAnomaliesFromStore, buildStoreFromDays } = require('../services/analyticsCore');
    const { detectRobustAnomalies } = require('../services/robustAnomaly');

    const days = {};
    for (let i = 1; i <= 10; i++) {
      const d = `2026-06-${String(i).padStart(2, '0')}`;
      days[d] = { heartRate: [68, 70, 69, 71], spo2: [97, 98], steps: 4000 };
    }
    days['2026-06-10'] = {
      heartRate: [70, 72, 130, 128, 132, 71, 73],
      spo2: [97, 98],
      steps: 5000,
    };
    const store = buildStoreFromDays(days, '2026-06-10');

    const viaCore = detectAnomaliesFromStore(store);
    const viaMad = detectRobustAnomalies(store);
    assert.deepEqual(viaCore, viaMad.anomalies);
    assert.ok(viaCore.length > 0);
    assert.equal(viaCore[0].rule, 'hr_mad_baseline');
    assert.ok(viaMad.baseline.hrMedian > 0);
    assert.ok(viaMad.method, 'robust-mad-heuristic');
  });

  test('high-activity days filtered from HR baseline (anti motion artifact)', () => {
    const { detectRobustAnomalies } = require('../services/robustAnomaly');
    const days = {};
    for (let i = 1; i <= 7; i++) {
      days[`2026-07-0${i}`] = {
        heartRate: [68, 70, 69],
        spo2: [97],
        steps: 9000, // high activity — excluded from baseline
      };
    }
    days['2026-07-07'] = {
      heartRate: [70, 72, 130, 128, 132],
      spo2: [97],
      steps: 3000,
    };
    const store = { daily: days };
    const r = detectRobustAnomalies(store);
    // baseline HR readings insufficient because all prior days are high-activity
    assert.equal(r.anomalies.length, 0);
    assert.match(r.disclaimer, /Insufficient baseline/i);
  });
});

// --- 3. Zod validation + SQLite batch transactions ---

describe('Zod validation (extractFeatures.js) + batch ingest (parser → dao)', () => {
  let tmpDataDir;

  before(() => {
    tmpDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medwear-verify-'));
    process.env.MEDWEAR_DATA_DIR = tmpDataDir;
    // Reset singleton DB so tests use temp dir
    try {
      const { closeDb } = require('../health/db');
      closeDb();
    } catch { /* first load */ }
  });

  test('extractFeatures cleans artifacts then passes Zod schema', () => {
    const { extractFeatures, FEATURE_NAMES } = require('../services/extractFeatures');
    const features = extractFeatures({
      days: {
        '2026-02-01': {
          steps: 7000,
          heartRate: [72, 230, 74], // 230 → imputed
          spo2: [97, 42, 96], // 42 → imputed
          hrv: [45],
          sleepMinutes: { deep: 60, rem: 90, light: 200, awake: 10 },
        },
      },
      targetDay: '2026-02-01',
    });
    assert.equal(Object.keys(features).length, FEATURE_NAMES.length);
    assert.ok(features.avg_hr <= 220);
    assert.ok(features.min_spo2 >= 50);
    assert.ok(features.avg_spo2 >= 50);
  });

  test('extractFeatures rejects invalid vector via Zod', () => {
    const { validateFeatureVector } = require('../services/physioValidation');
    assert.throws(
      () => validateFeatureVector({ steps_norm: -1, avg_hr: 72 }),
      /Invalid|Required|expected/i,
    );
  });

  test('ingestRecordBatch writes to SQLite in a single transaction', () => {
    const { initImportSession, ingestRecordBatch, finalizeImport, assembleStore } = require('../health/dao');
    const { getDb } = require('../health/db');

    initImportSession({ importedAt: new Date().toISOString(), sourceFile: 'test.xml' });
    const records = Array.from({ length: 1500 }, (_, i) => ({
      type: 'HKQuantityTypeIdentifierStepCount',
      value: '100',
      startDate: `2026-03-${String((i % 28) + 1).padStart(2, '0')} 08:00:00 +0000`,
      endDate: `2026-03-${String((i % 28) + 1).padStart(2, '0')} 09:00:00 +0000`,
      sourceName: 'Apple Watch',
    }));

    let txCount = 0;
    const db = getDb();
    const origTransaction = db.transaction.bind(db);
    db.transaction = (fn) => {
      txCount += 1;
      return origTransaction(fn);
    };

    ingestRecordBatch(records.slice(0, 1000));
    ingestRecordBatch(records.slice(1000));
    finalizeImport({ parsedRecords: 1500, userLabel: 'Test' });

    assert.ok(txCount >= 2, 'expected batch transactions');
    const store = assembleStore();
    assert.ok(store.meta.dayCount > 0);
    const stepSum = Object.values(store.daily).reduce((s, d) => s + (d.steps || 0), 0);
    assert.equal(stepSum, 1500 * 100);
  });

  test('parser BATCH_SIZE is 1000 and uses ingestRecordBatch', () => {
    const { BATCH_SIZE } = require('../health/parser');
    const parserSrc = fs.readFileSync(path.join(__dirname, '../health/parser.js'), 'utf8');
    assert.equal(BATCH_SIZE, 1000);
    assert.match(parserSrc, /ingestRecordBatch/);
    assert.match(parserSrc, /batch\.length >= BATCH_SIZE/);
  });
});
