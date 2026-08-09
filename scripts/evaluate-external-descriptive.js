#!/usr/bin/env node
/**
 * Descriptive validation on exported portable feature rows (same schema as ML pipeline).
 * Full WESAD / PPG-DaLiA runs require separate dataset adapters — this reports internal export stats
 * as a reproducible baseline for external comparison methodology.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const OUT = path.join(__dirname, '../benchmarks/results/external-descriptive-latest.json');
const FEATURES = path.join(__dirname, '../experiments/data/medwear/features_v1.csv');
const DATASET = path.join(__dirname, '../benchmarks/wearable-analytics-dataset.json');

function exportFeaturesIfNeeded() {
  if (fs.existsSync(FEATURES)) {
    const lines = fs.readFileSync(FEATURES, 'utf8').trim().split('\n').length;
    if (lines > 100) return;
  }
  if (!fs.existsSync(DATASET)) return;
  spawnSync(process.execPath, [
    path.join(__dirname, 'export_features.js'),
    '--input', DATASET,
    '--out', FEATURES,
  ], { stdio: 'inherit' });
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

function main() {
  exportFeaturesIfNeeded();
  if (!fs.existsSync(FEATURES)) {
    console.error('No feature export. Run: npm run experiment:export');
    process.exit(1);
  }
  const rows = parseCsv(fs.readFileSync(FEATURES, 'utf8'));
  const labels = {};
  rows.forEach((r) => { labels[r.label] = (labels[r.label] || 0) + 1; });

  let heuristicCorrect = 0;
  rows.forEach((r) => {
    const score = parseFloat(r.health_score_norm);
    const pred = score >= 0.8 ? 'low' : score >= 0.6 ? 'moderate' : 'high';
    if (pred === r.label) heuristicCorrect++;
  });

  const payload = {
    generatedAt: new Date().toISOString(),
    featureFile: FEATURES,
    n: rows.length,
    labelDistribution: labels,
    heuristicBhiTierAccuracy: +(heuristicCorrect / Math.max(rows.length, 1)).toFixed(4),
    portableSchema: true,
    externalDatasetsPlanned: ['WESAD (stress/arousal proxy)', 'PPG-DaLiA (activity HR proxy)'],
    note_en:
      'Descriptive check on exported 17-dim feature rows. External public datasets require separate download adapters — not included in repo.',
    note_zh: '对已导出 17 维特征行的描述性检查。公开数据集需单独下载适配器。',
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));
  console.log(`External descriptive baseline → ${OUT} (n=${rows.length})`);
}

main();
