#!/usr/bin/env node
/**
 * Validate simulated cohort against SEER / NLST / China NCCR reference subsets.
 *
 * Usage:
 *   node scripts/validate-clinical-cohort.js
 *        [--output benchmarks/results/clinical-validation-latest.json]
 */

const fs = require('fs');
const path = require('path');
const { runCohortValidation } = require('../server/screening/cohortValidator');

const DEFAULT_OUT = path.join(__dirname, '../benchmarks/results/clinical-validation-latest.json');

function pct(x) {
  return x == null ? '—' : `${(x * 100).toFixed(1)}%`;
}

function run() {
  return runCohortValidation();
}

if (require.main === module) {
  const out = process.argv.includes('--output')
    ? process.argv[process.argv.indexOf('--output') + 1]
    : DEFAULT_OUT;
  const report = run();
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 2));

  const h = report.headline;
  const v = report.verdict;
  console.log(`MedWear Clinical Cohort Validation — n=${report.cohort.n}`);
  console.log('  Outcome alignment (simulated intervention arm vs references)');
  console.log(`  Early diagnosis rate (I/II)     ${pct(h.earlyDiagnosisRate_iv)}`);
  console.log(`  Median dx→treatment (days)      ${h.treatmentMedianDays_iv ?? '—'}`);
  console.log(`  5y survival gain (IV−UC)        ${pct(h.survival5yGain)}`);
  console.log('  Diagnostic metrics (wearable risk vs malignancy gold standard)');
  console.log(`  Sensitivity                     ${pct(h.sensitivity)}`);
  console.log(`  Specificity                     ${pct(h.specificity)}`);
  console.log(`  PPV                             ${pct(h.ppv)}`);
  console.log(`  AUC                             ${h.auc ?? '—'}`);
  console.log(`  Verdict: ${v.status_zh} (${v.passed}/${v.total} checks)`);
  console.log(`  → ${out}`);
}

module.exports = { run };
