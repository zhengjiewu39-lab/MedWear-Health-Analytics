/** Map prediction API payloads to the active UI language. */
const CATEGORY_LABEL_EN = {
  training: 'Training & recovery',
  sleep: 'Sleep health',
  cardio: 'Cardiovascular',
  metabolic: 'Metabolic',
  infection: 'Infection / acute illness',
  respiratory: 'Respiratory',
  mental: 'Stress & mental health',
  seasonal: 'Seasonal health',
  other: 'Other',
};

export function localizePrediction(p, isEn) {
  if (!isEn || !p) return p;
  return {
    ...p,
    categoryLabel: p.categoryLabel_en || CATEGORY_LABEL_EN[p.category] || p.categoryLabel,
    risk: p.risk_en || p.risk,
    timeframe: p.timeframe_en || p.timeframe,
    factors: p.factors_en || p.factors,
    recommendation: p.recommendation_en || p.recommendation,
  };
}

export function localizePredictions(list, isEn) {
  return (list || []).map((p) => localizePrediction(p, isEn));
}
