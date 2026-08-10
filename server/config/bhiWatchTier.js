/**
 * BHI watch tiers — behavioral wellness stratification, NOT calibrated disease risk.
 * Internal keys (low/moderate/high) kept for benchmark label compatibility.
 */

const BHI_WATCH_TIERS = {
  low: {
    key: 'low',
    bhiMin: 80,
    label_zh: '当前平稳（BHI≥80）',
    label_en: 'Stable (BHI≥80)',
    short_zh: '当前平稳',
    short_en: 'Stable',
  },
  moderate: {
    key: 'moderate',
    bhiMin: 60,
    bhiMax: 79.99,
    label_zh: '建议观察（BHI 60–79）',
    label_en: 'Observe (BHI 60–79)',
    short_zh: '建议观察',
    short_en: 'Observe',
  },
  high: {
    key: 'high',
    bhiMax: 59.99,
    label_zh: '建议重点关注（BHI<60）',
    label_en: 'Watch closely (BHI<60)',
    short_zh: '建议重点关注',
    short_en: 'Watch closely',
  },
  unknown: {
    key: 'unknown',
    label_zh: '数据不足',
    label_en: 'Insufficient data',
    short_zh: '待导入',
    short_en: 'Pending',
  },
};

function classifyBHIWatchTier(score) {
  if (score == null || Number.isNaN(score)) return 'unknown';
  if (score >= 80) return 'low';
  if (score >= 60) return 'moderate';
  return 'high';
}

/** @deprecated use classifyBHIWatchTier */
const classifyRiskFromScore = classifyBHIWatchTier;

function getBHIWatchTierMeta(tier) {
  return BHI_WATCH_TIERS[tier] || BHI_WATCH_TIERS.unknown;
}

module.exports = {
  BHI_WATCH_TIERS,
  classifyBHIWatchTier,
  classifyRiskFromScore,
  getBHIWatchTierMeta,
};
