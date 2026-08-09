/**
 * Attach BHI field semantics to API payloads (healthScore = BHI, backward-compatible name).
 */
const { SCORE_FIELD } = require('../services/behavioralHealthIndex');

function attachScoreMeta(payload, lang = 'en') {
  if (payload == null || typeof payload !== 'object') return payload;
  return {
    ...payload,
    scoreField: SCORE_FIELD.apiField,
    scoreKind: SCORE_FIELD.kind,
    scoreLabel: lang === 'zh' ? SCORE_FIELD.label_zh : SCORE_FIELD.label_en,
    scoreLabelShort: lang === 'zh'
      ? '行为健康指数（非疾病风险）'
      : 'Behavioral Health Index (not disease risk)',
    scoreFieldNote: lang === 'zh' ? SCORE_FIELD.note_zh : SCORE_FIELD.note_en,
  };
}

module.exports = { SCORE_FIELD, attachScoreMeta };
