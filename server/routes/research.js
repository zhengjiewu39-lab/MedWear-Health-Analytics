const express = require('express');
const fs = require('fs');
const path = require('path');
const { getOutcomeSummary, getFunnel, getCohort } = require('../screening/outcomeModel');
const { getAllReferences } = require('../ai/engine');
const { run: runOutcomeEval } = require('../../scripts/evaluate-screening-outcomes');
const { run: runClinicalValidation } = require('../../scripts/validate-clinical-cohort');
const {
  runCohortValidation,
  listReferenceSubsets,
  getReferenceSubset,
} = require('../screening/cohortValidator');
const {
  getFrameworkPayload,
  summarizeWearableResults,
  wearable: wearablePolicy,
} = require('../config/evaluationFramework');

const router = express.Router();
const DATASET_PATH = path.join(__dirname, '../../benchmarks/screening-outcome-dataset.json');
const RESULTS_PATH = path.join(__dirname, '../../benchmarks/results/screening-outcomes-latest.json');
const VALIDATION_PATH = path.join(__dirname, '../../benchmarks/results/clinical-validation-latest.json');
const WEARABLE_DATASET_PATH = path.join(__dirname, '../../benchmarks/wearable-analytics-dataset.json');
const WEARABLE_RESULTS_PATH = path.join(__dirname, '../../benchmarks/results/latest.json');

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

function loadWearableBenchmarkSummary() {
  if (!fs.existsSync(WEARABLE_DATASET_PATH)) {
    return {
      available: false,
      message: 'Wearable benchmark not found. Run npm run generate:benchmark',
    };
  }
  const raw = JSON.parse(fs.readFileSync(WEARABLE_DATASET_PATH, 'utf8'));
  const riskLevel = { low: 0, moderate: 0, high: 0 };
  const anomaly = { true: 0, false: 0 };
  (raw.cases || []).forEach((c) => {
    if (c.expected?.riskLevel) riskLevel[c.expected.riskLevel] += 1;
    if (c.expected?.anomaly != null) anomaly[c.expected.anomaly] += 1;
  });
  return {
    available: true,
    dataset: raw.dataset,
    version: raw.version,
    license: raw.license || 'CC-BY-4.0',
    superseded: raw.superseded,
    description: raw.description,
    n: raw.n,
    seed: raw.seed,
    daysPerCase: raw.daysPerCase,
    expansionMethod: raw.expansionMethod,
    labelSource: raw.labelSource || wearablePolicy.labelSource,
    generatedAt: raw.generatedAt,
    phenotypeDistribution: raw.phenotypeDistribution || raw.archetypeDistribution,
    archetypeDistribution: raw.archetypeDistribution,
    physiologyMix: raw.physiologyMix,
    clinicalCharacteristics: raw.clinicalCharacteristics,
    rng: raw.rng,
    thresholds: raw.thresholds,
    labelDistribution: { riskLevel, anomaly },
    sampleCases: (raw.cases || []).slice(0, 16).map((c) => ({
      id: c.id,
      label: c.label,
      expected: c.expected,
    })),
    reproducible: {
      generate: 'npm run generate:benchmark',
      evaluate: 'npm run evaluate',
      reference: 'benchmarks/wearable-analytics-dataset.json',
    },
    latestEvaluation: fs.existsSync(WEARABLE_RESULTS_PATH)
      ? summarizeWearableResults(JSON.parse(fs.readFileSync(WEARABLE_RESULTS_PATH, 'utf8')))
      : null,
    alertMetrics: (() => {
      if (!fs.existsSync(WEARABLE_RESULTS_PATH)) return null;
      const summary = summarizeWearableResults(JSON.parse(fs.readFileSync(WEARABLE_RESULTS_PATH, 'utf8')));
      return summary?.alertMetrics || summary?.metrics?.alerts || null;
    })(),
  };
}

function loadWearableResults() {
  if (fs.existsSync(WEARABLE_RESULTS_PATH)) {
    const raw = JSON.parse(fs.readFileSync(WEARABLE_RESULTS_PATH, 'utf8'));
    return summarizeWearableResults(raw) || {
      dataset: raw.dataset,
      version: raw.version,
      evaluatedAt: raw.evaluatedAt,
      n: raw.n,
      engine: raw.engine,
      metrics: raw.metrics,
      mismatchCount: (raw.mismatches || []).length,
      circularLabelWarning: raw.circularLabelWarning || null,
      integrity: 'independent-gold',
    };
  }
  return {
    message: 'No cached wearable results. Run POST /research/wearable/evaluate first.',
    dataset: wearablePolicy.dataset,
    n: loadWearableBenchmarkSummary().n || null,
    metrics: null,
    integrity: 'pending',
  };
}

router.get('/framework', (_, res) => {
  const payload = getFrameworkPayload();
  const latest = loadWearableResults();
  if (latest?.metrics) payload.wearable.latestEvaluation = latest;
  res.json(payload);
});

router.get('/dataset', (_, res) => {
  res.json(loadDatasetSummary());
});

router.get('/wearable/dataset', (_, res) => {
  res.json(loadWearableBenchmarkSummary());
});

router.get('/wearable/results', (_, res) => {
  res.json(loadWearableResults());
});

router.post('/wearable/evaluate', (_, res) => {
  const { run } = require('../../scripts/evaluate-analytics');
  const results = run();
  fs.mkdirSync(path.dirname(WEARABLE_RESULTS_PATH), { recursive: true });
  fs.writeFileSync(WEARABLE_RESULTS_PATH, JSON.stringify(results, null, 2));
  const summary = summarizeWearableResults(results);
  res.json(summary);
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
  const wearable = loadWearableBenchmarkSummary();
  res.json({
    wearableBenchmark: wearable.available ? {
      name: wearable.dataset,
      version: wearable.version,
      n: wearable.n,
      seed: wearable.seed,
      superseded: wearable.superseded,
      expansionMethod: wearable.expansionMethod,
      labelSource: wearable.labelSource,
      archetypes: wearable.phenotypeDistribution?.length || 8,
      metrics: ['alert F1', 'alert precision', 'alert recall', 'anomaly accuracy', 'risk accuracy', 'score agreement (±8)', 'Wilson 95% CI'],
      latestAlertMetrics: wearable.latestEvaluation?.alertMetrics || wearable.latestEvaluation?.metrics?.alerts || null,
      evaluationModel: wearablePolicy.evaluationModel,
      goldStandard: wearablePolicy.goldStandard,
      productEngine: wearablePolicy.productEngine,
      reference: wearable.reproducible?.reference,
    } : null,
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
      wearable: {
        generate: 'npm run generate:benchmark',
        evaluate: 'npm run evaluate',
      },
      generate: 'npm run generate:cohort',
      evaluate: 'npm run evaluate:outcomes',
      validate: 'npm run validate:cohort',
      tests: 'npm run test:server',
    },
    clinicalValidation: {
      module: 'server/screening/cohortValidator.js',
      references: ['SEER', 'NLST', 'CHINA_NCCR'],
      metrics: ['earlyDiagnosisRate', 'treatmentDelay', 'survival5yGain', 'sensitivity', 'specificity', 'ppv', 'auc'],
    },
  });
});

router.get('/references/clinical', (_, res) => {
  res.json({
    subsets: listReferenceSubsets(),
    detail: {
      SEER: getReferenceSubset('SEER'),
      NLST: getReferenceSubset('NLST'),
      CHINA_NCCR: getReferenceSubset('CHINA_NCCR'),
    },
  });
});

router.get('/validate', (_, res) => {
  if (fs.existsSync(VALIDATION_PATH)) {
    return res.json(JSON.parse(fs.readFileSync(VALIDATION_PATH, 'utf8')));
  }
  return res.json({
    message: 'No cached validation. Run POST /research/validate first.',
    subsets: listReferenceSubsets(),
  });
});

router.post('/validate', (_, res) => {
  const report = runClinicalValidation();
  fs.mkdirSync(path.dirname(VALIDATION_PATH), { recursive: true });
  fs.writeFileSync(VALIDATION_PATH, JSON.stringify(report, null, 2));
  res.json(report);
});

router.get('/validate/live', (_, res) => {
  res.json(runCohortValidation());
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
    healthScoreFormula: 'BHI (behavioral-health-index): sigmoid/Gaussian components — see GET /api/methodology/transparency',
    engine: 'MedWear-AnalyticsCore-v1',
  });
});

module.exports = router;
