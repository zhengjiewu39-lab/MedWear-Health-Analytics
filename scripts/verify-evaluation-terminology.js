#!/usr/bin/env node
/** Fail if user-facing evaluation docs/UI prose still use deprecated clinical/gold terminology. */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const FILES = [
  'docs/EVALUATION.md',
  'docs/EVALUATION.zh.md',
  'docs/METHODS.md',
  'docs/METHODS.zh.md',
  'docs/EXTERNAL-VALIDATION.md',
  'docs/EXTERNAL-VALIDATION.zh.md',
  'README.md',
  'src/pages/ResearchCenter.js',
  'src/components/EvaluationIntegrityBanner.js',
  'src/components/EvaluationSupplementPanel.js',
];

const FORBIDDEN = [
  /MedWear-Wearable-Analytics-Clinical-v2/i,
  /engine-vs-gold/i,
  /Benchmark gold/i,
  /clinicalGoldStandard-v1/i,
  /reference gold labels/i,
  /\bRisk tier\b/i,
  /\bRisk Accuracy\b/i,
  /independent adjudication/i,
  /Gold-tier ML/i,
  /Gold 分层/i,
  /Engine vs gold/i,
  /Engine vs clinical gold/i,
  /clinical gold standard/i,
  /Benchmark gold/i,
  /vs gold reference/i,
  /\brisk stratification\b/i,
  /clinical-random adults/i,
  /Medical Wearable Health Analytics Platform/i,
  /\(deep \+ rem \+ light \+ awake\)/i,
  /Rule Engine \(Screening\)/i,
  /\boncology screening\b/i,
  /disease screening scores/i,
];

let failed = false;
for (const rel of FILES) {
  const filePath = path.join(ROOT, rel);
  if (!fs.existsSync(filePath)) continue;
  const text = fs.readFileSync(filePath, 'utf8');
  FORBIDDEN.forEach((re) => {
    const m = text.match(re);
    if (m) {
      console.error(`${rel}: forbidden term "${m[0]}"`);
      failed = true;
    }
  });
}

if (failed) {
  console.error('\nEvaluation terminology check failed. Use independent synthetic reference / BHI watch tier / engine-versus-reference agreement.');
  process.exit(1);
}
console.log('Evaluation terminology check passed (EVALUATION, METHODS, README, primary UI).');
