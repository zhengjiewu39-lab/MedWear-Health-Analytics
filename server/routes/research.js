const express = require('express');
const fs = require('fs');
const path = require('path');
const { getOutcomeSummary, getFunnel, getCohort } = require('../screening/outcomeModel');
const { getAllReferences } = require('../ai/engine');
const { run: runOutcomeEval } = require('../../scripts/evaluate-screening-outcomes');

const router = express.Router();
const DATASET_PATH = path.join(__dirname, '../../benchmarks/screening-outcome-dataset.json');
const RESULTS_PATH = path.join(__dirname, '../../benchmarks/results/screening-outcomes-latest.json');

function loadDatasetSummary() {
  const summary = getOutcomeSummary();
  const { patients } = getCohort();
  let fileMeta = null;
  if (fs.existsSync(DATASET_PATH)) {
    try {
      const raw = JSON.parse(fs.readFileSync(DATASET_PATH, 'utf8'));
      fileMeta = raw.meta;
    } catch { /* ignore */ }
  }
  return {
    meta: fileMeta || summary.meta,
    headline: summary.headline,
    comparison: summary.comparison,
    stageDistribution: summary.stageDistribution,
    byCategory: summary.byCategory,
    samplePatients: patients.slice(0, 40),
    totalPatients: summary.meta.n,
    license: 'CC-BY-4.0',
    reproducible: 'npm run evaluate:outcomes',
  };
}

router.get('/dataset', (_, res) => {
  res.json(loadDatasetSummary());
});

router.get('/results', (_, res) => {
  if (fs.existsSync(RESULTS_PATH)) {
    return res.json(JSON.parse(fs.readFileSync(RESULTS_PATH, 'utf8')));
  }
  const summary = getOutcomeSummary();
  return res.json({
    message: 'No cached results. Run POST /research/evaluate first.',
    dataset: summary.meta.name,
    n: summary.meta.n,
    comparison: summary.comparison,
    headline: summary.headline,
    metrics: null,
  });
});

router.get('/methods', (_, res) => {
  res.json({
    cohort: {
      name: 'MedWear-Screening-Outcome-Cohort-v1',
      n: 5000,
      arms: ['intervention (screened)', 'usual_care (control)'],
      seed: 'deterministic mulberry32',
      reference: 'benchmarks/screening-outcome-dataset.json',
    },
    headlineMetrics: [
      'earlyDiagnosisRate (stage I/II)',
      'treatmentRate (90-day initiation)',
      'survival5y (simulated)',
    ],
    signals: {
      proxy: ['restingHR', 'hrv', 'spo2', 'steps', 'sleepHours', 'systolicBP'],
      method: 'Transparent rule engine + cohort simulation',
    },
    pathway: {
      steps: 'screening → anomaly → prediction → AI intervention → report → exam → evaluation → outcomes',
    },
    reproducibility: {
      generate: 'npm run generate:cohort',
      evaluate: 'npm run evaluate:outcomes',
      tests: 'npm run test:server',
    },
  });
});

router.get('/references', (_, res) => {
  res.json(getAllReferences());
});

router.post('/evaluate', (_, res) => {
  const results = runOutcomeEval();
  res.json(results);
});

router.post('/analyze', (req, res) => {
  const { days, targetDay, thresholds } = req.body;
  if (!days || !Object.keys(days).length) {
    return res.status(400).json({ message: 'Provide days object with wearable metrics' });
  }
  const core = require('../services/analyticsCore');
  const caseData = { id: 'live', days, targetDay: targetDay || Object.keys(days).sort().pop() };
  const result = core.evaluateCase(caseData, thresholds || {});
  res.json({
    ...result,
    healthScoreFormula: 'steps(30%)+sleep(25%)+RHR(20%)+SpO2(15%)+HRV(10%)',
    engine: 'MedWear-AnalyticsCore-v1',
  });
});

module.exports = router;
