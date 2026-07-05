#!/usr/bin/env node
/**
 * Export MedWear wearable features + labels for Python ML experiments.
 * Usage:
 *   node scripts/export_features.js --input benchmarks/wearable-analytics-dataset.json --out experiments/data/medwear/features_v1.csv
 */

const fs = require('fs');
const path = require('path');
const { FEATURE_NAMES, extractFeatures, extractLabels } = require('../server/services/extractFeatures');

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    input: 'benchmarks/wearable-analytics-dataset.json',
    out: 'experiments/data/medwear/features_v1.csv',
    format: 'csv',
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input' || args[i] === '--dataset') opts.input = args[++i];
    else if (args[i] === '--out') opts.out = args[++i];
    else if (args[i] === '--format') opts.format = args[++i];
  }
  return opts;
}

function loadCases(filePath) {
  const raw = JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
  return raw.cases || raw;
}

function rowFromCase(c) {
  const features = extractFeatures(c);
  const { label, task } = extractLabels(c);
  const row = { id: c.id, label, task };
  for (const f of FEATURE_NAMES) row[f] = features[f] ?? 0;
  return row;
}

function toCsv(rows) {
  const cols = ['id', 'label', 'task', ...FEATURE_NAMES];
  const lines = [cols.join(',')];
  for (const r of rows) lines.push(cols.map(c => r[c]).join(','));
  return lines.join('\n');
}

function main() {
  const opts = parseArgs();
  const cases = loadCases(opts.input);
  const rows = cases.map(rowFromCase);

  fs.mkdirSync(path.dirname(path.resolve(opts.out)), { recursive: true });

  if (opts.format === 'json') {
    fs.writeFileSync(opts.out, JSON.stringify({ features: FEATURE_NAMES, rows }, null, 2));
  } else {
    fs.writeFileSync(opts.out, toCsv(rows));
  }

  console.log(`Exported ${rows.length} rows → ${opts.out}`);
}

if (require.main === module) main();
module.exports = { rowFromCase, loadCases };
