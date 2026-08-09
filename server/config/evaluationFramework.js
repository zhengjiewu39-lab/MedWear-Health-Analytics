/**
 * MedWear evaluation integrity policy — single source of truth for API + UI.
 * Prevents circular self-evaluation (engine-labeled gold standards → fake 100%).
 */

const { SCORE_FIELD } = require('../services/behavioralHealthIndex');

const PRODUCT_ENGINE = 'MedWear-AnalyticsCore-v1';
const GOLD_STANDARD = 'clinicalGoldStandard-v1';
const CIRCULAR_THRESHOLD = 0.98;

const wearable = {
  dataset: 'MedWear-Wearable-Analytics-Clinical-v2',
  version: '2.5.0',
  n: 5000,
  seed: 42,
  rng: 'mulberry32',
  labelSource: 'clinical-gold-standard-v1',
  expansionMethod: 'clinical-random-physiology-fp-adjudication',
  physiologyMix: { clinicalRandom: 0.28, phenotypeRandom: 0.72 },
  clinicalPhysiologyModule: 'clinicalPhysiology-v1',
  alertFalsePositiveScenarios: ['exercise_fp', 'spo2_artifact_fp', 'recovery_rest_fp'],
  productAlertModel: 'peak-and-single-reading (wearable-style)',
  goldAdjudication: 'contextual-clinical-suppression',
  productEngine: PRODUCT_ENGINE,
  goldStandard: GOLD_STANDARD,
  evaluationModel: 'engine-vs-gold-agreement',
  scoreAgreementTolerance: 8,
  circularThreshold: CIRCULAR_THRESHOLD,
  commands: {
    generate: 'npm run generate:benchmark',
    evaluate: 'npm run evaluate',
  },
  description_zh:
    '临床随机生理 + 误报场景（运动心率峰值/SpO₂ 伪影/恢复日）；产品用峰值/单点触发，金标准经临床上下文抑制。评测=引擎 vs 金标准，非自评。',
  description_en:
    'Clinical random physiology with FP scenarios (exercise HR peaks, SpO₂ artifact, rest day). Product uses peak/single-reading triggers; gold applies contextual suppression. Engine vs gold — not self-test.',
  invalidIf_zh: '若告警/异常/风险/评分四项均≥98%，说明金标准与引擎同源，临床性能估计无效。',
  invalidIf_en:
    'If alert/anomaly/risk/score metrics are all ≥98%, gold labels are likely engine-derived — invalid for clinical estimation.',
};

const screening = {
  dataset: 'MedWear-Screening-Outcome-Cohort-v1',
  n: 5000,
  evaluationModel: 'intervention-vs-control-simulation',
  description_zh: '随机合成队列；评测为筛查组 vs 对照组结局对比，非分类准确率自评。',
  description_en: 'Stochastic synthetic cohort; evaluation compares intervention vs control outcomes — not classification self-test.',
};

const clinicalValidation = {
  module: 'server/screening/cohortValidator.js',
  evaluationModel: 'simulated-vs-literature-reference',
  references: ['SEER', 'NLST', 'CHINA_NCCR'],
  description_zh: '模拟队列与已发表登记/试验参考区间对照，含灵敏度/特异性/AUC（非引擎自评）。',
  description_en: 'Simulated cohort vs published registry/trial reference bands, including sensitivity/specificity/AUC (not engine self-test).',
};

function isCircularMetrics(metrics) {
  if (!metrics) return false;
  const vals = [
    metrics.alertExactMatchRate ?? metrics.alerts?.f1,
    metrics.anomalyAccuracy,
    metrics.riskAccuracy,
    metrics.healthScoreAgreementRate ?? metrics.healthScoreInRangeRate,
  ].filter((x) => x != null);
  return vals.length >= 4 && vals.every((x) => x >= CIRCULAR_THRESHOLD);
}

function summarizeWearableResults(raw) {
  if (!raw?.metrics) return null;
  const alerts = raw.metrics.alerts || {};
  return {
    evaluatedAt: raw.evaluatedAt,
    n: raw.n,
    engine: raw.engine,
    goldStandard: GOLD_STANDARD,
    metrics: raw.metrics,
    alertMetrics: {
      f1: alerts.f1,
      precision: alerts.precision,
      recall: alerts.recall,
      exactMatchRate: raw.metrics.alertExactMatchRate,
    },
    mismatchCount: (raw.mismatches || []).length,
    circularLabelWarning: raw.circularLabelWarning || (isCircularMetrics(raw.metrics)
      ? wearable.invalidIf_en
      : null),
    integrity: isCircularMetrics(raw.metrics) ? 'invalid-circular' : 'independent-gold',
  };
}

module.exports = {
  PRODUCT_ENGINE,
  GOLD_STANDARD,
  CIRCULAR_THRESHOLD,
  wearable,
  screening,
  clinicalValidation,
  isCircularMetrics,
  summarizeWearableResults,
  getFrameworkPayload() {
    return {
      wearable,
      screening,
      clinicalValidation,
      productEngine: PRODUCT_ENGINE,
      scoreField: SCORE_FIELD,
    };
  },
};
