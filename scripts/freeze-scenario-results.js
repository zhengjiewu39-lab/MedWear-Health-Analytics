#!/usr/bin/env node
/** Freeze GET /api/outcomes/scenarios payload → benchmarks/results/scenarios-latest.json */
const fs = require('fs');
const path = require('path');
const { getScenarioSensitivity, getOutcomeSummary } = require('../server/screening/outcomeModel');

const outPath = path.join(__dirname, '../benchmarks/results/scenarios-latest.json');
const payload = {
  generatedAt: new Date().toISOString(),
  source: 'server/screening/outcomeModel.js → getScenarioSensitivity()',
  disclosure: 'Exploratory scenario simulation — highly parameter-driven, no p-values.',
  baseSummary: getOutcomeSummary(),
  ...getScenarioSensitivity(),
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
console.log(`Frozen scenario sensitivity → ${outPath}`);
