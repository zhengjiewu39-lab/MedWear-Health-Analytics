#!/usr/bin/env node
/**
 * Evaluate bundled public-dataset proxy samples (WESAD stress proxy) + internal export baseline.
 */
const fs = require('fs');
const path = require('path');
const {
  generateWesadStressProxySample,
  evaluateProxyDataset,
} = require('../server/adapters/publicDatasetAdapter');

const OUT = path.join(__dirname, '../benchmarks/results/external-descriptive-latest.json');
const WESAD_OUT = path.join(__dirname, '../benchmarks/external/wesad-stress-proxy.json');

function loadInternalExport() {
  const featuresPath = path.join(__dirname, '../experiments/data/medwear/features_v1.csv');
  if (!fs.existsSync(featuresPath)) return null;
  const lines = fs.readFileSync(featuresPath, 'utf8').trim().split('\n');
  const rows = lines.slice(1);
  let ok = 0;
  rows.forEach((line) => {
    const [, label, , ...rest] = line.split(',');
    const score = parseFloat(rest[rest.length - 1]);
    const pred = score >= 0.8 ? 'low' : score >= 0.6 ? 'moderate' : 'high';
    if (pred === label) ok++;
  });
  return { n: rows.length, heuristicBhiTierAccuracy: +(ok / Math.max(rows.length, 1)).toFixed(4) };
}

function main() {
  const wesad = generateWesadStressProxySample(120, 42);
  fs.mkdirSync(path.dirname(WESAD_OUT), { recursive: true });
  fs.writeFileSync(WESAD_OUT, JSON.stringify(wesad, null, 2));

  const wesadEval = evaluateProxyDataset(wesad);
  const internal = loadInternalExport();

  const payload = {
    generatedAt: new Date().toISOString(),
    internalExport: internal,
    wesadStressProxy: wesadEval,
    ppgDaLiA: {
      status: 'planned',
      note_en: 'PPG-DaLiA adapter stub — download dataset and map activity-HR windows to portable schema.',
      note_zh: 'PPG-DaLiA 适配器占位 — 需下载数据集并映射活动-心率窗口。',
    },
    portableSchema: 'server/services/extractFeatures.js → FEATURE_NAMES (17 dims)',
    externalDatasetsPlanned: ['WESAD (stress/arousal proxy)', 'PPG-DaLiA (activity HR proxy)'],
    note_en:
      'WESAD proxy uses literature-calibrated synthetic windows; internal export uses n=5000 synthetic benchmark. Not substitute for full external validation.',
    note_zh: 'WESAD 代理为文献校准合成窗口；内部导出为 n=5000 合成基准。不能替代完整外部验证。',
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));
  console.log(`Public dataset evaluation → ${OUT}`);
  console.log(`  WESAD proxy n=${wesadEval.n} BHI-tier acc=${wesadEval.heuristicBhiTierAccuracy}`);
  if (internal) console.log(`  Internal export n=${internal.n} BHI-tier acc=${internal.heuristicBhiTierAccuracy}`);
}

main();
