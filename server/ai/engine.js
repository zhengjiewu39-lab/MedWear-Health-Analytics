/**
 * MedWear rule engine — evidence-weighted domain placeholders.
 * NOT a trained multi-model ML ensemble; no declared validation accuracies.
 */
const { mockData, PROFILE } = require('../mock/clinicalData');
const { getReference, getAllReferences, EVIDENCE_LABELS } = require('../data/researchReferences');

const RULE_ENGINE_DISCLAIMER =
  'Evidence-weighted rule engine — domain weights and legacy field names (models, modelVotes, ensembleConfidence) are placeholders, not trained ML outputs.';

/** Configurable domain weight placeholders (not trained models). */
const DOMAIN_WEIGHTS = [
  { id: 'cardio-rules', domain: '心血管', domain_en: 'Cardiovascular', weight: 0.28, role: 'rule-placeholder' },
  { id: 'vitals-rules', domain: '生命体征', domain_en: 'Vital signs', weight: 0.22, role: 'rule-placeholder' },
  { id: 'oncology-rules', domain: '肿瘤筛查', domain_en: 'Oncology screening', weight: 0.18, role: 'rule-placeholder' },
  { id: 'metabolic-rules', domain: '代谢', domain_en: 'Metabolic', weight: 0.16, role: 'rule-placeholder' },
  { id: 'sleep-rules', domain: '睡眠呼吸', domain_en: 'Sleep & respiration', weight: 0.16, role: 'rule-placeholder' },
];

/** @deprecated Use DOMAIN_WEIGHTS — kept for API compatibility without accuracy fields. */
const MODELS = DOMAIN_WEIGHTS.map((m) => ({
  id: m.id,
  domain: m.domain,
  weight: m.weight,
  role: m.role,
  disclaimer: 'Rule-engine placeholder — not a validated ML model',
}));

const ITEM_RESEARCH_MAP = {
  '肺结节/肺癌': 'lung_cancer',
  '结直肠肿瘤': 'colorectal_cancer',
  '甲状腺结节': 'thyroid',
  '肝胆胰肿瘤': 'liver_cancer',
  '肝癌': 'liver_cancer',
  '乳腺癌': 'breast_cancer',
  '胃癌': 'gastric_cancer',
  '前列腺癌': 'prostate_cancer',
  '宫颈癌': 'cervical_cancer',
  '高血压': 'hypertension',
  '2 型糖尿病': 'diabetes',
  '血脂异常': 'dyslipidemia',
  '慢性阻塞性肺病': 'copd',
  '慢性肾病': 'chronic_kidney_disease',
  '睡眠呼吸暂停': 'sleep_apnea',
  '冠心病/心梗': 'coronary',
  '脑卒中': 'stroke',
  '心律失常': 'arrhythmia',
  '心力衰竭风险': 'coronary',
  // Acute/allergic respiratory — shared respiratory key (COPD/asthma/influenza guidelines as approximate proxy)
  '普通感冒': 'respiratory',
  '流行性感冒': 'respiratory',
  '急性上呼吸道感染': 'respiratory',
  '过敏性鼻炎': 'respiratory',
  '社区获得性肺炎': 'respiratory',
  '支气管哮喘': 'respiratory',
};

function evidenceAdjustedRisk(risk, evidenceLevel) {
  const wSum = DOMAIN_WEIGHTS.reduce((s, m) => s + m.weight, 0);
  const evidenceFactor = { A: 1.0, B: 0.97, C: 0.92 }[evidenceLevel] || 0.9;
  return Math.round(risk * evidenceFactor * (wSum / DOMAIN_WEIGHTS.length) * 10) / 10;
}

function heuristicConfidence(risk, evidenceLevel) {
  const evidenceBoost = { A: 0.06, B: 0.03, C: 0.01 }[evidenceLevel] || 0;
  const base = 0.55 + evidenceBoost - risk / 800;
  return Math.min(0.85, Math.max(0.45, +base.toFixed(3)));
}

/** @deprecated */
const ensembleScore = evidenceAdjustedRisk;
/** @deprecated */
const calibrateConfidence = heuristicConfidence;

function buildEvidenceChain(researchId) {
  const ref = getReference(researchId);
  if (!ref) return [];
  return ref.references.map(r => ({
    ...r,
    citation: `[${r.org}, ${r.year}] ${r.title}${r.doi ? ` DOI:${r.doi}` : ''}`,
  }));
}

function analyzeCondition(name, risk, level) {
  const researchId = ITEM_RESEARCH_MAP[name];
  const ref = researchId ? getReference(researchId) : null;
  const evidenceLevel = ref?.evidenceLevel || 'C';
  return {
    name,
    rawRisk: risk,
    calibratedRisk: evidenceAdjustedRisk(risk, evidenceLevel),
    level,
    evidenceLevel,
    evidenceLabel: EVIDENCE_LABELS[evidenceLevel],
    confidence: heuristicConfidence(risk, evidenceLevel),
    engine: 'MedWear-RuleEngine-v1',
    engineType: 'evidence-weighted-rule-engine',
    model: ref?.model || 'MedWear-RuleEngine-v1',
    aiModel: ref?.model || 'MedWear-RuleEngine-v1',
    metrics: ref?.metrics || [],
    thresholds: ref?.thresholds || {},
    references: ref?.references || [],
    evidenceChain: researchId ? buildEvidenceChain(researchId) : [],
    disclaimer: RULE_ENGINE_DISCLAIMER,
  };
}

function runFullAnalysis(patientData) {
  const data = patientData || mockData;
  const scr = data.diseaseScreening;
  const d = data.dashboard?.stats || data.stats || mockData.dashboard.stats;
  const profile = data.profile || PROFILE;

  const conditions = scr.categories.flatMap(c =>
    c.items.map(item => analyzeCondition(item.name, item.risk, item.level))
  );

  const domainVotes = DOMAIN_WEIGHTS.map(m => ({
    ...m,
    vote: conditions.reduce((s, c) => s + c.calibratedRisk * m.weight, 0) / Math.max(1, conditions.length),
  }));

  return {
    version: 'MedWear-RuleEngine-v1',
    engineType: 'evidence-weighted-rule-engine',
    generatedAt: new Date().toISOString(),
    patient: profile,
    /** @deprecated legacy alias — heuristic confidence, not ML ensemble */
    ensembleConfidence: heuristicConfidence(scr.overallScore, 'A'),
    domainWeights: DOMAIN_WEIGHTS,
    /** @deprecated legacy alias — domain weight placeholders */
    models: MODELS,
    /** @deprecated legacy alias — weighted rule votes, not model inference */
    modelVotes: domainVotes,
    conditions,
    summary: scr.summary,
    overallRisk: scr.overallRisk,
    overallScore: scr.overallScore,
    fusionWeights: { wearable: 0.55, clinical: 0.30, behavioral: 0.15 },
    dataQuality: scr.dataCoverage.quality,
    disclaimer: RULE_ENGINE_DISCLAIMER,
    legacyFieldsNote:
      'Fields models, modelVotes, ensembleConfidence, and aiModel are compatibility aliases — not trained ML ensemble outputs.',
    vitalsUsed: {
      heartRate: d.heartRate, restingHR: d.restingHR, spo2: d.spo2,
      hrv: d.hrv, steps: d.steps, sleep: d.sleepHours, bmi: profile.bmi,
    },
  };
}

function enrichScreeningData(screening) {
  return {
    ...screening,
    aiVersion: 'MedWear-RuleEngine-v1',
    engineType: 'evidence-weighted-rule-engine',
    disclaimer: RULE_ENGINE_DISCLAIMER,
    legacyFieldsNote:
      'aiModel names label rule-engine reference domains — not trained neural networks.',
    categories: screening.categories.map(cat => ({
      ...cat,
      items: cat.items.map(item => {
        const rid = ITEM_RESEARCH_MAP[item.name];
        const ref = rid ? getReference(rid) : null;
        if (!ref) return item;
        return {
          ...item,
          researchId: rid,
          evidenceLevel: ref.evidenceLevel,
          evidenceLabel: EVIDENCE_LABELS[ref.evidenceLevel],
          engineType: 'evidence-weighted-rule-engine',
          aiModel: ref.model,
          measuredMetrics: ref.metrics,
          clinicalThresholds: ref.thresholds,
          calibratedRisk: evidenceAdjustedRisk(item.risk, ref.evidenceLevel),
          confidence: heuristicConfidence(item.risk, ref.evidenceLevel),
          references: ref.references,
          disclaimer: RULE_ENGINE_DISCLAIMER,
        };
      }),
    })),
  };
}

module.exports = {
  DOMAIN_WEIGHTS,
  MODELS,
  ITEM_RESEARCH_MAP,
  RULE_ENGINE_DISCLAIMER,
  runFullAnalysis,
  enrichScreeningData,
  analyzeCondition,
  evidenceAdjustedRisk,
  heuristicConfidence,
  ensembleScore,
  calibrateConfidence,
  getAllReferences,
};
