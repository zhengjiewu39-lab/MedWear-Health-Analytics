#!/usr/bin/env node
/**
 * Fair ML comparison — raw wearable features only (no BHI / anomaly_flag).
 * Rule engine preferred for interpretability, not because sklearn "loses" on oracle features.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { run: runEvaluate } = require('./evaluate-analytics');
const { RAW_FEATURE_NAMES, extractRawFeatures, extractLabels } = require('../server/services/extractFeatures');
const { loadCases } = require('./export_features');

const OUT = path.join(__dirname, '../benchmarks/results/ml-comparison-fair-latest.json');
const FEATURES = path.join(__dirname, '../experiments/data/medwear/features_fair_v1.csv');
const DATASET = path.join(__dirname, '../benchmarks/wearable-analytics-dataset.json');
const TRAIN = path.join(__dirname, '../experiments/medwear/train.py');

function exportFairFeatures() {
  const cases = loadCases(DATASET);
  const cols = ['id', 'label', 'task', ...RAW_FEATURE_NAMES];
  const lines = [cols.join(',')];
  cases.forEach((c) => {
    const features = extractRawFeatures(c);
    const { label, task } = extractLabels(c);
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

function nodeBaselines(rows) {
  const labels = ['low', 'moderate', 'high'];
  const yTrue = rows.map((r) => r.label);
  const counts = {};
  yTrue.forEach((l) => { counts[l] = (counts[l] || 0) + 1; });
  const majority = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  const majorityPred = yTrue.map(() => majority);
  const hrPred = rows.map((r) => {
    const hr = parseFloat(r.avg_hr);
    const steps = parseFloat(r.steps_norm) * 10000;
    if (hr > 90 || steps < 3000) return 'high';
    if (hr > 80 || steps < 5000) return 'moderate';
    return 'low';
  });
  const acc = (pred) => pred.filter((p, i) => p === yTrue[i]).length / yTrue.length;
  return [
    { name: 'majority-class', type: 'node-baseline', accuracy: +acc(majorityPred).toFixed(4), macroF1: +macroF1(yTrue, majorityPred, labels).toFixed(4) },
    { name: 'hr-steps-heuristic', type: 'node-baseline', accuracy: +acc(hrPred).toFixed(4), macroF1: +macroF1(yTrue, hrPred, labels).toFixed(4) },
  ];
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
  const n = exportFairFeatures();
  spawnSync('python3', ['-m', 'pip', 'install', '-q', '-r', path.join(__dirname, '../experiments/medwear/requirements-min.txt')], {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
  });

  const evalResults = runEvaluate();
  const ruleEngine = {
    name: 'MedWear-RuleEngine-v1 + AnalyticsCore',
    type: 'rule-engine',
    riskAccuracy: evalResults.metrics.riskAccuracy,
    alertF1: evalResults.metrics.alerts?.f1,
    note: 'Engine vs clinicalGoldStandard-v1 — primary product metric',
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
    comparisonKind: 'fair-raw-wearable-only',
    featureCount: RAW_FEATURE_NAMES.length,
    featureNames: RAW_FEATURE_NAMES,
    nSamples: n,
    task: 'BHI watch tier (low/moderate/high) from raw wearable features only',
    ruleEngine,
    nodeBaselines: nodeBaselineResults,
    mlModels,
    primaryRationale:
      'Rule engine is preferred for interpretability, auditability, and evidence-linked screening — NOT because it beats sklearn on oracle (engine-derived) features.',
    disclosure:
      'Fair comparison excludes health_score_norm and anomaly_flag. Sklearn scores here reflect portable raw-signal predictability only — not independent clinical validation.',
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));
  console.log(`Fair ML comparison → ${OUT} (${RAW_FEATURE_NAMES.length} features, n=${n})`);
}

main();
