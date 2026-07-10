#!/usr/bin/env node
/**
 * Reproducible evaluation of the screened-vs-unscreened outcome comparison.
 *
 * Usage:
 *   node scripts/evaluate-screening-outcomes.js
 *        [--output benchmarks/results/screening-outcomes-latest.json]
 *
 * Reads the deterministic cohort model and reports the paper's headline
 * comparison metrics (stage shift, treatment initiation, time-to-treatment,
 * simulated 5-year survival, chronic-disease control) with intervention-vs-
 * control deltas, overall and by disease category.
 */

const fs = require('fs');
const path = require('path');
const { getOutcomeSummary, getFunnel } = require('../server/screening/outcomeModel');

const DEFAULT_OUT = path.join(__dirname, '../benchmarks/results/screening-outcomes-latest.json');

function pct(x) {
  return x == null ? '—' : `${(x * 100).toFixed(1)}%`;
}

function run() {
  const summary = getOutcomeSummary();
  const funnel = getFunnel();
  return {
    dataset: summary.meta.name,
    version: summary.meta.version,
    evaluatedAt: new Date().toISOString(),
    engine: 'MedWear-ScreeningOutcome-v1',
    n: summary.meta.n,
    comparison: summary.comparison,
    stageDistribution: summary.stageDistribution,
    byCategory: summary.byCategory,
    funnel,
    params: summary.params,
  };
}

if (require.main === module) {
  const out = process.argv.includes('--output')
    ? process.argv[process.argv.indexOf('--output') + 1]
    : DEFAULT_OUT;
  const results = run();
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(results, null, 2));
  const c = results.comparison;
  console.log(`MedWear Screening-Outcome Evaluation — n=${results.n}`);
  console.log('  Metric                         Intervention   Control    Δ');
  console.log(`  Early-stage (I/II) detection   ${pct(c.earlyStageRate.intervention).padEnd(13)}  ${pct(c.earlyStageRate.control).padEnd(8)}  +${pct(c.earlyStageRate.delta)}`);
  console.log(`  Treatment initiation (90d)     ${pct(c.treatmentInitiationRate.intervention).padEnd(13)}  ${pct(c.treatmentInitiationRate.control).padEnd(8)}  +${pct(c.treatmentInitiationRate.delta)}`);
  console.log(`  Median dx→treatment (days)     ${String(c.medianDaysToTreatment.intervention).padEnd(13)}  ${String(c.medianDaysToTreatment.control).padEnd(8)}  ${c.medianDaysToTreatment.delta}`);
  console.log(`  Mean simulated 5y survival     ${pct(c.meanSurvival5y.intervention).padEnd(13)}  ${pct(c.meanSurvival5y.control).padEnd(8)}  +${pct(c.meanSurvival5y.delta)}`);
  console.log(`  Chronic control rate           ${pct(c.chronicControlRate.intervention).padEnd(13)}  ${pct(c.chronicControlRate.control).padEnd(8)}  +${pct(c.chronicControlRate.delta)}`);
  console.log(`  → ${out}`);
}

module.exports = { run };
