/** Map anomaly API payloads to the active UI language. */
const AI_MODEL_EN = {
  '统计异常检测': 'Statistical anomaly detection',
  analyticsCore: 'analyticsCore',
};

export function localizeAnomaly(a, isEn) {
  if (!isEn || !a) return a;
  return {
    ...a,
    type: a.type_en || a.type,
    pattern: a.pattern_en || a.pattern,
    aiModel: a.aiModel_en || AI_MODEL_EN[a.aiModel] || a.aiModel,
  };
}

export function localizeAnomalies(list, isEn) {
  return (list || []).map((a) => localizeAnomaly(a, isEn));
}
