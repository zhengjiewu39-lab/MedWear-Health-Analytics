#!/usr/bin/env node
/** Regenerate evaluation supplement JSON artifacts and patch EVALUATION.md sections. */
const { spawnSync } = require('child_process');
const path = require('path');
const { syncEvaluationSupplement } = require('../server/config/evaluationSupplement');

const root = path.join(__dirname, '..');
const steps = [
  'freeze-scenario-results.js',
  'analyze-fp-burden.js',
  'evaluate-public-datasets.js',
  'sensitivity-outcomes.js',
  'experiment-compare-fair.js',
  'experiment-compare-oracle.js',
];

for (const s of steps) {
  console.log(`\n→ ${s}`);
  const r = spawnSync(process.execPath, [path.join(__dirname, s)], { cwd: root, stdio: 'inherit' });
  if (r.status !== 0) console.warn(`Warning: ${s} exited ${r.status}`);
}

syncEvaluationSupplement(root);
console.log('\nSynced EVALUATION.md / EVALUATION.zh.md supplement sections.');
