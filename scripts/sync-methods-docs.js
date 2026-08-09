#!/usr/bin/env node
/** Regenerate docs/METHODS.md and docs/METHODS.zh.md from methodologyTransparency.js */
const path = require('path');
const { syncMethodsDocs } = require('../server/config/methodologyTransparency');

const root = path.join(__dirname, '..');
const out = syncMethodsDocs(root);
console.log('Synced methodology docs from single source of truth:');
console.log(' ', out.en);
console.log(' ', out.zh);
