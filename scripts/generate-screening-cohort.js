#!/usr/bin/env node
/**
 * Generate the reproducible screening-outcome benchmark cohort.
 *
 * Usage:
 *   node scripts/generate-screening-cohort.js [--n 2400] [--seed 20260709]
 *        [--output benchmarks/screening-outcome-dataset.json]
 *
 * Output is a large, physiologically realistic SYNTHETIC cohort with two arms
 * (intervention = wearable early screening; usual_care = control), used for the
 * screened-vs-unscreened outcome comparison. See server/screening/outcomeModel.js.
 */

const fs = require('fs');
const path = require('path');
const {
  generateCohort, DEFAULT_SEED, DEFAULT_N,
} = require('../server/screening/outcomeModel');

function argVal(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const n = Number(argVal('--n', DEFAULT_N));
const seed = Number(argVal('--seed', DEFAULT_SEED));
const out = argVal('--output', path.join(__dirname, '../benchmarks/screening-outcome-dataset.json'));

const cohort = generateCohort({ seed, n });
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(cohort, null, 2));

const iv = cohort.patients.filter((p) => p.arm === 'intervention');
const uc = cohort.patients.filter((p) => p.arm === 'usual_care');
console.log(`MedWear Screening-Outcome Cohort — n=${cohort.patients.length} (seed ${seed})`);
console.log(`  Intervention arm: ${iv.length}`);
console.log(`  Usual-care arm:   ${uc.length}`);
console.log(`  → ${out}`);
