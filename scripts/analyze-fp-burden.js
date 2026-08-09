#!/usr/bin/env node
/**
 * Estimate downstream follow-up burden from alert false positives (scenario analysis).
 * Reads benchmarks/results/latest.json from engine-vs-gold evaluation.
 */
const fs = require('fs');
const path = require('path');

const IN = path.join(__dirname, '../benchmarks/results/latest.json');
const OUT = path.join(__dirname, '../benchmarks/results/fp-burden-latest.json');

const ASSUMPTIONS = {
  populationPer1000: 1000,
  /** Share of flagged individuals who receive an extra clinical workup (scenario). */
  followUpRatePerFpAlert: 0.35,
  /** Mean additional outpatient visits per workup (scenario). */
  visitsPerWorkup: 1.2,
  disclaimer_en:
    'Illustrative burden model using evaluation alert precision — not observed healthcare utilization.',
  disclaimer_zh: '基于评测告警精确率的说明性负担模型 — 非真实医疗利用数据。',
};

function main() {
  if (!fs.existsSync(IN)) {
    console.error('Run npm run evaluate first.');
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(IN, 'utf8'));
  const n = raw.n || raw.cases?.length || 0;
  const alerts = raw.metrics?.alerts || {};
  const precision = alerts.precision ?? 0;
  const recall = alerts.recall ?? 0;

  let tp = 0; let fp = 0; let fn = 0;
  (raw.cases || []).forEach((c) => {
    const exp = new Set(c.expected?.alerts || []);
    const pred = new Set(c.predicted?.alerts || []);
    pred.forEach((a) => { if (exp.has(a)) tp++; else fp++; });
    exp.forEach((a) => { if (!pred.has(a)) fn++; });
  });

  const flaggedPer1000 = Math.round((tp + fp) / Math.max(n, 1) * ASSUMPTIONS.populationPer1000);
  const fpPer1000 = Math.round(fp / Math.max(n, 1) * ASSUMPTIONS.populationPer1000);
  const workupsPer1000 = Math.round(fpPer1000 * ASSUMPTIONS.followUpRatePerFpAlert);
  const visitsPer1000 = +(workupsPer1000 * ASSUMPTIONS.visitsPerWorkup).toFixed(1);

  const payload = {
    generatedAt: new Date().toISOString(),
    source: IN,
    n,
    alertMetrics: { precision, recall, f1: alerts.f1, tp, fp, fn },
    assumptions: ASSUMPTIONS,
    per1000: {
      individualsWithAnyAlert: flaggedPer1000,
      falsePositiveAlerts: fpPer1000,
      estimatedFollowUpWorkups: workupsPer1000,
      estimatedExtraOutpatientVisits: visitsPer1000,
    },
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));
  console.log(`FP burden scenario → ${OUT}`);
  console.log(`  FP alerts / 1000: ${fpPer1000} · est. workups / 1000: ${workupsPer1000}`);
}

main();
