/** BHI watch tier labels for UI — not disease risk stratification. */

export const BHI_WATCH_TIER = {
  low: {
    label_zh: '当前平稳（BHI≥80）',
    label_en: 'Stable (BHI≥80)',
    short_zh: '当前平稳',
    short_en: 'Stable',
    color: 'success',
  },
  moderate: {
    label_zh: '建议观察（BHI 60–79）',
    label_en: 'Observe (BHI 60–79)',
    short_zh: '建议观察',
    short_en: 'Observe',
    color: 'warning',
  },
  high: {
    label_zh: '建议重点关注（BHI<60）',
    label_en: 'Watch closely (BHI<60)',
    short_zh: '建议重点关注',
    short_en: 'Watch closely',
    color: 'error',
  },
  unknown: {
    label_zh: '数据不足',
    label_en: 'Insufficient data',
    short_zh: '待导入',
    short_en: 'Pending',
    color: 'default',
  },
};

export function bhiTierLabel(tier, isEn = false) {
  const m = BHI_WATCH_TIER[tier] || BHI_WATCH_TIER.unknown;
  return isEn ? m.label_en : m.label_zh;
}

export function bhiTierShort(tier, isEn = false) {
  const m = BHI_WATCH_TIER[tier] || BHI_WATCH_TIER.unknown;
  return isEn ? m.short_en : m.short_zh;
}
