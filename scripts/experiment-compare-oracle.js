#!/usr/bin/env node
/**
 * Oracle ML comparison — includes engine-derived BHI/anomaly flags (feature leakage).
 * Appendix only — do NOT compare directly to rule-engine-vs-gold metrics.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const OUT = path.join(__dirname, '../benchmarks/results/ml-comparison-oracle-latest.json');
const FEATURES = path.join(__dirname, '../experiments/data/medwear/features_v1.csv');
const DATASET = path.join(__dirname, '../benchmarks/wearable-analytics-dataset.json');
const TRAIN = path.join(__dirname, '../experiments/medwear/train.py');

function ensureFeatures() {
  spawnSync(process.execPath, [
    path.join(__dirname, 'export_features.js'),
    '--input', DATASET,
    '--out', FEATURES,
  ], { stdio: 'pipe' });
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
  ensureFeatures();
  spawnSync('python3', ['-m', 'pip', 'install', '-q', '-r', path.join(__dirname, '../experiments/medwear/requirements-min.txt')], {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
  });

  const mlModels = ['lr', 'dt', 'rf'].map((m) => {
    const res = runPythonModel(m);
    if (!res) return null;
    return {
      name: m,
      type: 'sklearn-oracle',
      macroF1: res.metrics?.macro_f1_mean,
      accuracy: res.metrics?.accuracy_mean,
      nSamples: res.n_samples,
      expId: res.exp_id,
    };
  }).filter(Boolean);

  const payload = {
    generatedAt: new Date().toISOString(),
    comparisonKind: 'oracle-engine-derived-features',
    featureCount: 17,
    includesEngineDerived: ['health_score_norm', 'anomaly_flag'],
    mlModels,
    appendixOnly: true,
    featureLeakageWarning:
      'Exported features include BHI (health_score_norm) and anomaly_flag from the product engine. High sklearn CV (~0.94–0.98) reflects circular/engine-derived signal — NOT independent validation.',
    doNotUseFor:
      'Do not cite oracle sklearn accuracy as evidence the rule engine is inferior. See fair comparison: npm run experiment:compare-fair',
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));
  console.log(`Oracle ML comparison (appendix) → ${OUT}`);
}

main();
