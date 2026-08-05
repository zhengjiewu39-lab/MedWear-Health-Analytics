/**
 * MedWear evaluation integrity policy — single source of truth for API + UI.
 * Prevents circular self-evaluation (engine-labeled gold standards → fake 100%).
 */

const PRODUCT_ENGINE = 'MedWear-AnalyticsCore-v1';
const GOLD_STANDARD = 'clinicalGoldStandard-v1';
const CIRCULAR_THRESHOLD = 0.98;

const wearable = {
  dataset: 'MedWear-Wearable-Analytics-Clinical-v2',
  version: '2.2.0',
  n: 1000,
  seed: 42,
  labelSource: 'clinical-gold-standard-v1',
  expansionMethod: 'random-physiology-clinical-adjudication',
  physiologyMix: { uniformRandom: 0.28, phenotypeRandom: 0.72 },
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
    '生理信号随机合成；金标准由独立临床裁决模块生成，与产品引擎阈值/公式分离。评测指标=引擎输出 vs 金标准一致率，非自评。',
  description_en:
    'Random physiology synthesis; gold labels from an independent clinical adjudication module (separate thresholds/formulas). Metrics = product engine vs gold agreement — not self-test.',
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
  return {
    evaluatedAt: raw.evaluatedAt,
    n: raw.n,
    engine: raw.engine,
    goldStandard: GOLD_STANDARD,
    metrics: raw.metrics,
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
    return { wearable, screening, clinicalValidation, productEngine: PRODUCT_ENGINE };
  },
};
