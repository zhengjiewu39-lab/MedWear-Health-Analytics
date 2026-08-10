/**
 * ONNX Runtime inference for MedWear wearable risk classification.
 * Model artifacts: server/ai/models/medwear_<model>.onnx + .meta.json
 */
const fs = require('fs');
const path = require('path');
const { FEATURE_NAMES } = require('../services/extractFeatures');

const MODELS_DIR = path.join(__dirname, 'models');
const DEFAULT_MODEL = process.env.MEDWEAR_ONNX_MODEL || 'medwear_rf';

let session = null;
let meta = null;
let loadError = null;

function modelPaths(modelId = DEFAULT_MODEL) {
  const base = path.join(MODELS_DIR, modelId);
  return { onnx: `${base}.onnx`, meta: `${base}.meta.json` };
}

function findAvailableModel() {
  if (!fs.existsSync(MODELS_DIR)) return null;
  const files = fs.readdirSync(MODELS_DIR).filter((f) => f.endsWith('.onnx'));
  if (!files.length) return null;
  const preferred = files.find((f) => f.startsWith('medwear_rf')) || files[0];
  return preferred.replace('.onnx', '');
}

async function loadModel(modelId) {
  const id = modelId || process.env.MEDWEAR_ONNX_MODEL || findAvailableModel();
  if (!id) {
    loadError = 'No ONNX model found in server/ai/models/. Run: npm run experiment:train';
    return false;
  }

  const { onnx, meta: metaPath } = modelPaths(id);
  if (!fs.existsSync(onnx) || !fs.existsSync(metaPath)) {
    loadError = `Missing model files for ${id}`;
    return false;
  }

  try {
    const ort = require('onnxruntime-node');
    session = await ort.InferenceSession.create(onnx, {
      executionProviders: ['cpu'],
    });
    meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    loadError = null;
    return true;
  } catch (err) {
    loadError = err.message;
    session = null;
    meta = null;
    return false;
  }
}

function isModelLoaded() {
  return Boolean(session && meta);
}

function getModelInfo() {
  return meta ? {
    modelId: meta.model_id,
    modelType: meta.model_type,
    featureCount: meta.feature_cols?.length,
    labelClasses: meta.label_classes,
    metrics: meta.metrics,
    exportedAt: meta.exported_at,
  } : null;
}

function featuresToTensor(features) {
  const values = FEATURE_NAMES.map((k) => Number(features[k] ?? 0));
  const ort = require('onnxruntime-node');
  return new ort.Tensor('float32', Float32Array.from(values), [1, values.length]);
}

function parseOutputResults(results) {
  const labelKey = Object.keys(results).find((k) => k.includes('label')) || 'output_label';
  const probKey = Object.keys(results).find((k) => k.includes('prob'));

  let probabilities = null;
  let classIndex = 0;

  if (labelKey && results[labelKey]?.data) {
    classIndex = Number(results[labelKey].data[0]);
  }

  if (probKey && results[probKey]?.data) {
    // Dense probability tensor (some exporters)
    probabilities = Array.from(results[probKey].data);
    if (probabilities.length) classIndex = probabilities.indexOf(Math.max(...probabilities));
  } else if (probKey && results[probKey]?.cpuData) {
    probabilities = Array.from(results[probKey].cpuData);
  }

  const classes = meta.label_classes || ['high', 'low', 'moderate'];
  const label = classes[classIndex] ?? classes[0];
  const confidence = probabilities?.length ? probabilities[classIndex] : null;

  return { label, classIndex, probabilities, confidence };
}

async function predictRisk(features, modelId) {
  if (!isModelLoaded()) {
    const ok = await loadModel(modelId);
    if (!ok) throw new Error(loadError || 'ONNX model not loaded');
  }

  const inputName = session.inputNames[0];
  const tensor = featuresToTensor(features);
  // Request label only — skl2onnx probability output is often ZipMap (unsupported in node ORT)
  const labelOutput = session.outputNames.find((n) => n.includes('label')) || session.outputNames[0];
  const results = await session.run({ [inputName]: tensor }, [labelOutput]);
  const parsed = parseOutputResults(results);

  const riskPercent = parsed.label === 'high' ? 72
    : parsed.label === 'moderate' ? 42
      : 18;

  return {
    label: parsed.label,
    riskLevel: parsed.label,
    riskPercent,
    confidence: parsed.confidence != null ? +parsed.confidence.toFixed(4) : null,
    probabilities: parsed.probabilities
      ? Object.fromEntries((meta.label_classes || []).map((c, i) => [c, +parsed.probabilities[i].toFixed(4)]))
      : null,
    engineType: 'onnx-runtime',
    modelId: meta.model_id,
    modelType: meta.model_type,
    featureVector: FEATURE_NAMES.map((k) => features[k]),
  };
}

function predictRiskSync(features) {
  // onnxruntime-node is async-only; expose sync wrapper via deasync pattern not used.
  throw new Error('Use predictRisk() — ONNX Runtime inference is asynchronous');
}

function resetModel() {
  session = null;
  meta = null;
  loadError = null;
}

module.exports = {
  MODELS_DIR,
  DEFAULT_MODEL,
  loadModel,
  isModelLoaded,
  getModelInfo,
  predictRisk,
  predictRiskSync,
  getLoadError: () => loadError,
  resetModel,
};
