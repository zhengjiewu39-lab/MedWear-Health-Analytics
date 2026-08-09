#!/usr/bin/env node
/**
 * Compare MedWear rule engine (evaluate) vs simple ML models on exported features.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { run: runEvaluate } = require('./evaluate-analytics');

const OUT = path.join(__dirname, '../benchmarks/results/ml-comparison-latest.json');
const FEATURES = path.join(__dirname, '../experiments/data/medwear/features_v1.csv');
const DATASET = path.join(__dirname, '../benchmarks/wearable-analytics-dataset.json');
const TRAIN = path.join(__dirname, '../experiments/medwear/train.py');

function parseCsv(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const vals = line.split(',');
    const row = {};
    headers.forEach((h, i) => { row[h] = vals[i]; });
    return row;
  });
}

function macroF1(yTrue, yPred, labels) {
  let f1s = [];
  labels.forEach((lab) => {
    let tp = 0; let fp = 0; let fn = 0;
    yTrue.forEach((t, i) => {
      const p = yPred[i];
      if (t === lab && p === lab) tp++;
      if (t !== lab && p === lab) fp++;
      if (t === lab && p !== lab) fn++;
    });
    const prec = tp + fp > 0 ? tp / (tp + fp) : 0;
    const rec = tp + fn > 0 ? tp / (tp + fn) : 0;
    f1s.push(prec + rec > 0 ? (2 * prec * rec) / (prec + rec) : 0);
  });
  return f1s.reduce((a, b) => a + b, 0) / labels.length;
}

function nodeBaselinesFromFeatures() {
  if (!fs.existsSync(FEATURES)) return [];
  const rows = parseCsv(fs.readFileSync(FEATURES, 'utf8'));
  const labels = ['low', 'moderate', 'high'];
  const yTrue = rows.map((r) => r.label);
  const counts = {};
  yTrue.forEach((l) => { counts[l] = (counts[l] || 0) + 1; });
  const majority = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  const majorityPred = yTrue.map(() => majority);
  const thresholdPred = rows.map((r) => {
    const s = parseFloat(r.health_score_norm);
    return s >= 0.8 ? 'low' : s >= 0.6 ? 'moderate' : 'high';
  });
  const acc = (pred) => pred.filter((p, i) => p === yTrue[i]).length / yTrue.length;
  return [
    { name: 'majority-class', type: 'node-baseline', accuracy: +acc(majorityPred).toFixed(4), macroF1: +macroF1(yTrue, majorityPred, labels).toFixed(4) },
    { name: 'bhi-threshold-heuristic', type: 'node-baseline', accuracy: +acc(thresholdPred).toFixed(4), macroF1: +macroF1(yTrue, thresholdPred, labels).toFixed(4) },
  ];
}

function ensurePythonDeps() {
  const r = spawnSync('python3', ['-c', 'import sklearn, pandas, joblib'], { encoding: 'utf8' });
  if (r.status === 0) return true;
  console.log('[ML] Installing minimal Python deps...');
  const pip = spawnSync('python3', ['-m', 'pip', 'install', '-q', '-r', path.join(__dirname, '../experiments/medwear/requirements-min.txt')], {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
  });
  return pip.status === 0;
}

function ensureFeatures() {
  spawnSync(process.execPath, [
    path.join(__dirname, 'export_features.js'),
    '--input', DATASET,
    '--out', FEATURES,
  ], { stdio: 'pipe' });
}

function runPythonModel(model) {
  const r = spawnSync('python3', [TRAIN, '--data', FEATURES, '--model', model, '--cv', '5', '--seed', '42'], {
    encoding: 'utf8',
    cwd: path.join(__dirname, '..'),
  });
  if (r.status !== 0) return null;
  const outLine = (r.stdout || '').split('\n').find((l) => l.trim().startsWith('→'));
  if (!outLine) return null;
  const jsonPath = path.resolve(path.join(__dirname, '..'), outLine.replace(/^→\s*/, '').trim());
  if (!fs.existsSync(jsonPath)) return null;
  return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
}

function main() {
  ensureFeatures();
  ensurePythonDeps();
  const evalResults = runEvaluate();
  const ruleEngine = {
    name: 'MedWear-RuleEngine-v1 + AnalyticsCore',
    type: 'rule-engine',
    riskAccuracy: evalResults.metrics.riskAccuracy,
    alertF1: evalResults.metrics.alerts?.f1,
    alertPrecision: evalResults.metrics.alerts?.precision,
    alertRecall: evalResults.metrics.alerts?.recall,
    bhiAgreement: evalResults.metrics.healthScoreAgreementRate,
    note: 'Engine vs clinicalGoldStandard-v1 on n=5000 synthetic benchmark',
  };

  const mlModels = ['lr', 'dt', 'rf'];
  const mlResults = [];
  const nodeBaselines = nodeBaselinesFromFeatures();
  for (const m of mlModels) {
    const res = runPythonModel(m);
    if (res) {
      mlResults.push({
        name: m,
        type: 'sklearn',
        macroF1: res.metrics?.macro_f1_mean,
        accuracy: res.metrics?.accuracy_mean,
        nSamples: res.n_samples,
        expId: res.exp_id,
      });
    }
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    task: 'risk-tier classification (low/moderate/high) on exported 17-dim features',
    ruleEngine,
    nodeBaselines,
    mlModels: mlResults,
    pythonRequired: mlResults.length === 0,
    pythonSetup: 'pip install -r experiments/medwear/requirements.txt',
    disclosure:
      'ML models trained on same synthetic export — features include engine-derived health_score_norm/anomaly_flag, so high sklearn scores do NOT imply independent validation. Compares interpretability vs simple ML on portable schema.',
    featureLeakageWarning:
      'Exported features include BHI/anomaly flags from the product engine — sklearn CV on this export can appear inflated vs engine-vs-gold evaluation.',
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));
  console.log(`ML comparison → ${OUT} (ML models: ${mlResults.length}/${mlModels.length})`);
}

main();
