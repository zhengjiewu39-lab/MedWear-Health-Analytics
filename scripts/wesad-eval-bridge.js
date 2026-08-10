#!/usr/bin/env node
/** JSON stdin → BHI tier + anomaly flag per case (WESAD adapter bridge). */
const { extractFeatures } = require('../server/services/extractFeatures');
const { classifyBHIWatchTier } = require('../server/config/bhiWatchTier');

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  const cases = JSON.parse(input || '[]');
  const out = cases.map((c) => {
    const f = extractFeatures(c);
    const tier = classifyBHIWatchTier((f.health_score_norm || 0) * 100);
    return {
      id: c.id,
      gold: c.gold,
      bhiTier: tier,
      anomalyFlag: f.anomaly_flag,
      healthScoreNorm: f.health_score_norm,
    };
  });
  process.stdout.write(JSON.stringify(out));
});
