/**
 * Methodology transparency — honest labels for scores, anomalies, rule engine, cohort simulation.
 */

const { WEIGHTS, SCORE_KIND } = require('../services/behavioralHealthIndex');
const { SENSITIVITY_PRESETS } = require('../services/robustAnomaly');

const healthScore = {
  kind: SCORE_KIND,
  label_en: 'Behavioral Health Index (BHI)',
  label_zh: '行为健康指数（BHI）',
  notDiseaseRisk: true,
  weights: WEIGHTS,
  features: [
    'Continuous smooth component functions (sigmoid/Gaussian)',
    'Optional age/sex RHR & HRV adjustment',
    'Sleep architecture includes awake minutes',
    'Missing components re-normalize with sensitivity report',
    'Optional 7-day trend adjustment (±3 pts max)',
  ],
  limitations_en: [
    'Not calibrated against clinical outcomes',
    'No comorbidity or medication adjustment',
    'Wearable proxy signals only',
  ],
};

const anomalyDetection = {
  method: 'robust-mad-heuristic',
  label_en: 'Robust MAD baseline + activity context filter',
  label_zh: '稳健 MAD 基线 + 活动量上下文过滤',
  notValidatedClinical: true,
  hrRule: 'Median + k·MAD on non-high-activity days; suppress when steps ≥ threshold',
  spo2Rule: 'Individual baseline median − k·MAD (not fixed 93%)',
  sensitivityPresets: Object.keys(SENSITIVITY_PRESETS),
  limitations_en: [
    'No multiple-testing correction',
    'Exercise/artifact context partially filtered only',
    'Heuristic — expect false positives under noise',
  ],
};

const ruleEngine = {
  label_en: 'Evidence-weighted rule engine (not ML ensemble)',
  label_zh: '证据加权规则引擎（非 ML 集成）',
  removedClaims: ['model validation accuracy', 'declared AUC from placeholder models'],
  domainWeights: [
    { domain: 'cardiovascular', weight: 0.28 },
    { domain: 'vitals', weight: 0.22 },
    { domain: 'oncology screening', weight: 0.18 },
    { domain: 'metabolic', weight: 0.16 },
    { domain: 'sleep', weight: 0.16 },
  ],
  fusionWeights: { wearable: 0.55, clinical: 0.30, behavioral: 0.15 },
  disclaimer_en: 'Domain weights are configurable placeholders — not trained model votes.',
};

const cohortSimulation = {
  kind: 'scenario-simulation',
  label_en: 'Synthetic screening-outcome cohort (scenario simulation)',
  label_zh: '合成筛查结局队列（情景模拟）',
  n: 5000,
  notRealWorldValidation: true,
  noPValues: true,
  scenarios: ['conservative', 'neutral', 'optimistic'],
  publicParameters: [
    'STAGE_DISTRIBUTION',
    'TREATMENT_INITIATION_RATE',
    'CHRONIC_CONTROL_RATE',
    'TIME_TO_TREATMENT',
    'computeRiskScore coefficients',
  ],
  limitations_en: [
    'Outcomes partially parameter-driven — not independent system validation',
    'Use for methodology demo and sensitivity analysis only',
  ],
};

function getMethodologyTransparency() {
  return {
    version: '1.0.0',
    updatedAt: new Date().toISOString(),
    healthScore,
    anomalyDetection,
    ruleEngine,
    cohortSimulation,
  };
}

module.exports = { getMethodologyTransparency, healthScore, anomalyDetection, ruleEngine, cohortSimulation };
