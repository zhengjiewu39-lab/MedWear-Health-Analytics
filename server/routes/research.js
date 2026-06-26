const express = require('express');
const fs = require('fs');
const path = require('path');
const { run } = require('../../scripts/evaluate-analytics');
const core = require('../services/analyticsCore');
const { getAllReferences } = require('../ai/engine');

const router = express.Router();

router.get('/dataset', (_, res) => {
  res.json(require('../../benchmarks/wearable-analytics-dataset.json'));
});

router.get('/results', (_, res) => {
  const p = path.join(__dirname, '../../benchmarks/results/latest.json');
  if (!fs.existsSync(p)) {
    return res.json({ message: 'No results yet. Run POST /research/evaluate first.', metrics: null });
  }
  res.json(JSON.parse(fs.readFileSync(p, 'utf8')));
});

router.get('/methods', (_, res) => {
  res.json({
    healthScore: {
      formula: 'Weighted composite: steps(30%) + sleep(25%) + RHR(20%) + SpO2(15%) + HRV(10%)',
      reference: 'docs/METHODS.md',
    },
    alerts: {
      rules: ['HR > threshold', 'HR < threshold', 'SpO2 < threshold', 'steps < 3000'],
      reference: 'docs/METHODS.md#alerts',
    },
    anomalies: {
      method: 'Personal baseline + 2σ on 14-day HR window; SpO2 < 93% repeated events',
      reference: 'docs/METHODS.md#anomalies',
    },
    riskStratification: {
      tiers: { low: 'score ≥ 80', moderate: '60–79', high: '< 60' },
    },
  });
});

router.get('/references', (_, res) => {
  res.json(getAllReferences());
});

router.post('/evaluate', (_, res) => {
  res.json(run());
});

router.post('/analyze', (req, res) => {
  const { days, targetDay, thresholds } = req.body;
  if (!days || !Object.keys(days).length) {
    return res.status(400).json({ message: 'Provide days object with wearable metrics' });
  }
  const caseData = { id: 'live', days, targetDay: targetDay || Object.keys(days).sort().pop() };
  const result = core.evaluateCase(caseData, thresholds || {});
  const store = core.buildStoreFromDays(days, caseData.targetDay);
  res.json({
    ...result,
    healthScoreFormula: 'steps(30%)+sleep(25%)+RHR(20%)+SpO2(15%)+HRV(10%)',
    engine: 'MedWear-AnalyticsCore-v1',
  });
});

module.exports = router;
