/**
 * MedWear evaluation integrity policy — single source of truth for API + UI.
 * Prevents circular self-evaluation (engine-labeled reference → fake 100%).
 */

const { SCORE_FIELD } = require('../services/behavioralHealthIndex');

const PRODUCT_ENGINE = 'MedWear-AnalyticsCore-v1';
const INDEPENDENT_SYNTHETIC_REFERENCE = 'independentSyntheticReference-v1';
/** @deprecated aliases — use INDEPENDENT_SYNTHETIC_REFERENCE in new docs/UI */
const INDEPENDENT_REFERENCE = INDEPENDENT_SYNTHETIC_REFERENCE;
const GOLD_STANDARD = INDEPENDENT_SYNTHETIC_REFERENCE;
const LEGACY_GOLD_STANDARD = 'clinicalGoldStandard-v1';
const CIRCULAR_THRESHOLD = 0.98;

const wearable = {
  dataset: 'MedWear-Wearable-Analytics-Benchmark-v3',
  legacyDataset: 'MedWear-Wearable-Analytics-Clinical-v2',
  version: '3.0.0',
  n: 5000,
  seed: 42,
  rng: 'mulberry32',
  labelSource: 'independent-synthetic-reference-v1',
  expansionMethod: 'clinical-random-physiology-fp-reference-labeling',
  physiologyMix: { clinicalRandom: 0.28, phenotypeRandom: 0.72 },
  clinicalPhysiologyModule: 'clinicalPhysiology-v1',
  alertFalsePositiveScenarios: ['exercise_fp', 'spo2_artifact_fp', 'recovery_rest_fp'],
  productAlertModel: 'peak-and-single-reading (wearable-style)',
  referenceLabeling: 'independent rule-based reference labeling with contextual suppression',
  productEngine: PRODUCT_ENGINE,
  referenceStandard: INDEPENDENT_SYNTHETIC_REFERENCE,
  /** @deprecated API alias — use referenceStandard */
  goldStandard: INDEPENDENT_SYNTHETIC_REFERENCE,
  evaluationModel: 'engine-versus-reference-agreement',
  scoreAgreementTolerance: 8,
  circularThreshold: CIRCULAR_THRESHOLD,
  commands: {
    generate: 'npm run generate:benchmark',
    evaluate: 'npm run evaluate',
  },
  description_zh:
    '合成生理 + 误报场景；产品用峰值/单点触发，独立合成参考标注经规则上下文抑制。评测=引擎 vs 参考一致率，非自评。',
  description_en:
    'Synthetic physiology with FP scenarios. Product uses peak/single-reading triggers; independent synthetic reference uses rule-based contextual suppression. Engine vs reference agreement — not self-test.',
  invalidIf_zh: '若告警/异常/BHI 分层/评分四项均≥98%，说明参考标签与引擎同源，一致率估计无效。',
  invalidIf_en:
    'If alert/anomaly/BHI-tier/score metrics are all ≥98%, reference labels are likely engine-derived — invalid agreement estimation.',
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
    metrics.bhiTierAgreement ?? metrics.riskAccuracy,
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
    referenceStandard: INDEPENDENT_SYNTHETIC_REFERENCE,
    legacyReferenceStandard: LEGACY_GOLD_STANDARD,
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
    integrity: isCircularMetrics(raw.metrics) ? 'invalid-circular' : 'independent-reference',
  };
}

module.exports = {
  PRODUCT_ENGINE,
  INDEPENDENT_SYNTHETIC_REFERENCE,
  INDEPENDENT_REFERENCE,
  GOLD_STANDARD,
  LEGACY_GOLD_STANDARD,
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
