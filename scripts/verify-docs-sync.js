#!/usr/bin/env node
/** Fail if docs/METHODS*.md drift from methodologyTransparency.js (single source of truth). */
const fs = require('fs');
const path = require('path');
const { renderMethodsMarkdown } = require('../server/config/methodologyTransparency');

const root = path.join(__dirname, '..');
const pairs = [
  ['docs/METHODS.md', true],
  ['docs/METHODS.zh.md', false],
];

let failed = false;
for (const [rel, isEn] of pairs) {
  const filePath = path.join(root, rel);
  const expected = renderMethodsMarkdown(isEn);
  const actual = fs.readFileSync(filePath, 'utf8');
  if (actual !== expected) {
    console.error(`${rel} is out of sync with server/config/methodologyTransparency.js`);
    console.error('Run: npm run docs:sync');
    failed = true;
  }
}

if (failed) process.exit(1);
console.log('METHODS docs in sync (EN/ZH parity verified).');
