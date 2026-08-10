#!/usr/bin/env node
/**
 * ML comparison with clinicalGoldStandard-v1 risk tier as label target.
 * Same raw wearable features as fair compare — labels from benchmark expected.riskLevel.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { run: runEvaluate } = require('./evaluate-analytics');
const { RAW_FEATURE_NAMES, extractRawFeatures, extractGoldRiskTierLabel } = require('../server/services/extractFeatures');
const { loadCases } = require('./export_features');

const OUT = path.join(__dirname, '../benchmarks/results/ml-comparison-vs-gold-latest.json');
const FEATURES = path.join(__dirname, '../experiments/data/medwear/features_vs_gold_v1.csv');
const DATASET = path.join(__dirname, '../benchmarks/wearable-analytics-dataset.json');
const TRAIN = path.join(__dirname, '../experiments/medwear/train.py');

function exportGoldFeatures() {
  const cases = loadCases(DATASET);
  const cols = ['id', 'label', 'task', ...RAW_FEATURE_NAMES];
  const lines = [cols.join(',')];
  cases.forEach((c) => {
    const features = extractRawFeatures(c);
    const { label, task } = extractGoldRiskTierLabel(c);
    const row = [c.id, label, task, ...RAW_FEATURE_NAMES.map((k) => features[k] ?? 0)];
    lines.push(row.join(','));
  });
  fs.mkdirSync(path.dirname(FEATURES), { recursive: true });
  fs.writeFileSync(FEATURES, lines.join('\n'));
  return cases.length;
}

function macroF1(yTrue, yPred, labels) {
  const f1s = labels.map((lab) => {
    let tp = 0; let fp = 0; let fn = 0;
    yTrue.forEach((t, i) => {
      const p = yPred[i];
      if (t === lab && p === lab) tp++;
      if (t !== lab && p === lab) fp++;
      if (t === lab && p !== lab) fn++;
    });
    const prec = tp + fp > 0 ? tp / (tp + fp) : 0;
    const rec = tp + fn > 0 ? tp / (tp + fn) : 0;
    return prec + rec > 0 ? (2 * prec * rec) / (prec + rec) : 0;
  });
  return f1s.reduce((a, b) => a + b, 0) / labels.length;
}

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

function nodeBaselines(rows) {
  const labels = ['low', 'moderate', 'high'];
  const yTrue = rows.map((r) => r.label);
  const counts = {};
  yTrue.forEach((l) => { counts[l] = (counts[l] || 0) + 1; });
  const majority = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  const majorityPred = yTrue.map(() => majority);
  const acc = (pred) => pred.filter((p, i) => p === yTrue[i]).length / yTrue.length;
  return [
    { name: 'majority-class', type: 'node-baseline', accuracy: +acc(majorityPred).toFixed(4), macroF1: +macroF1(yTrue, majorityPred, labels).toFixed(4) },
  ];
}

function runPythonModel(model) {
  const r = spawnSync('python3', [TRAIN, '--data', FEATURES, '--model', model, '--cv', '5', '--seed', '42', '--skip-onnx'], {
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
  const n = exportGoldFeatures();
  spawnSync('python3', ['-m', 'pip', 'install', '-q', '-r', path.join(__dirname, '../experiments/medwear/requirements-min.txt')], {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
  });

  const evalResults = runEvaluate();
  const ruleEngine = {
    name: 'MedWear-AnalyticsCore-v1',
    type: 'rule-engine',
    goldTierAgreement: evalResults.metrics.riskAccuracy,
    alertF1: evalResults.metrics.alerts?.f1,
    note: 'Product BHI watch tier vs clinicalGoldStandard-v1 reference risk tier (engine-vs-gold agreement)',
  };

  const rows = parseCsv(fs.readFileSync(FEATURES, 'utf8'));
  const nodeBaselineResults = nodeBaselines(rows);
  const mlModels = ['lr', 'dt', 'rf'].map((m) => {
    const res = runPythonModel(m);
    if (!res) return null;
    return {
      name: m,
      type: 'sklearn',
      macroF1: res.metrics?.macro_f1_mean,
      accuracy: res.metrics?.accuracy_mean,
      nSamples: res.n_samples,
      expId: res.exp_id,
    };
  }).filter(Boolean);

  const payload = {
    generatedAt: new Date().toISOString(),
    comparisonKind: 'vs-clinical-gold-risk-tier',
    labelSource: 'clinicalGoldStandard-v1 → expected.riskLevel',
    featureCount: RAW_FEATURE_NAMES.length,
    nSamples: n,
    task: 'Reference risk tier (low/moderate/high) from independent gold adjudication',
    ruleEngine,
    nodeBaselines: nodeBaselineResults,
    mlModels,
    disclosure:
      'Sklearn 5-fold CV predicts gold reference tiers from raw wearable features. Measures inter-engine / feature distinguishability ceiling — NOT independent clinical validation.',
    regenerate: 'npm run experiment:compare-vs-gold',
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));
  console.log(`Gold-tier ML comparison → ${OUT} (n=${n}, gold label target)`);
}

main();
