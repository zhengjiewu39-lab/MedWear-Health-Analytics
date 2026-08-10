/**
 * MedWear evidence-weighted rule engine — domain placeholders + optional ONNX backend.
 * Honest API field names; legacy ML-style aliases retained for backward compatibility only.
 */
const { getReference, getAllReferences, EVIDENCE_LABELS } = require('../data/researchReferences');
const { extractFeatures } = require('../services/extractFeatures');
const { predictRisk, isModelLoaded, getModelInfo, loadModel } = require('./onnxInference');

const ENGINE_TYPE = 'evidence-weighted-rule-engine';
const LEGACY_FIELDS_NOTE =
  'Deprecated aliases (aiModel, models, modelVotes, ensembleConfidence) are compatibility-only — not trained ML outputs.';

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
  '普通感冒': 'respiratory',
  '流行性感冒': 'respiratory',
  '急性上呼吸道感染': 'respiratory',
  '过敏性鼻炎': 'respiratory',
  '社区获得性肺炎': 'respiratory',
  '支气管哮喘': 'respiratory',
};

const DOMAIN_WEIGHTS = [
  { id: 'cardio-rules', domain: '心血管', domain_en: 'Cardiovascular', weight: 0.28, role: 'domain-weight-placeholder' },
  { id: 'vitals-rules', domain: '生命体征', domain_en: 'Vital signs', weight: 0.22, role: 'domain-weight-placeholder' },
  { id: 'oncology-rules', domain: '肿瘤筛查', domain_en: 'Oncology screening', weight: 0.18, role: 'domain-weight-placeholder' },
  { id: 'metabolic-rules', domain: '代谢', domain_en: 'Metabolic', weight: 0.16, role: 'domain-weight-placeholder' },
  { id: 'sleep-rules', domain: '睡眠呼吸', domain_en: 'Sleep & respiration', weight: 0.16, role: 'domain-weight-placeholder' },
];

const HIGH_LEVEL = (risk) => (risk >= 55 ? 'high' : risk >= 35 ? 'moderate' : 'low');

function evidenceAdjustedRisk(risk, evidenceLevel) {
  const evidenceFactor = { A: 1.0, B: 0.97, C: 0.92 }[evidenceLevel] || 0.9;
  return Math.round(risk * evidenceFactor * 10) / 10;
}

function computeHeuristicConfidence(prediction, evidenceLevel) {
  if (prediction?.confidence != null) {
    const evidenceBoost = { A: 0.04, B: 0.02, C: 0.01 }[evidenceLevel] || 0;
    return Math.min(0.85, Math.max(0.45, prediction.confidence + evidenceBoost));
  }
  return 0.55;
}

function buildEvidenceChain(researchId) {
  const ref = getReference(researchId);
  if (!ref) return [];
  return ref.references.map((r) => ({
    ...r,
    citation: `[${r.org}, ${r.year}] ${r.title}${r.doi ? ` DOI:${r.doi}` : ''}`,
  }));
}

function referenceDomainLabel(ref, prediction) {
  if (ref?.referenceDomainLabel) return ref.referenceDomainLabel;
  if (ref?.model) return ref.model;
  return prediction?.modelId || 'MedWear-RuleEngine-v1';
}

function analyzeCondition(name, risk, level, prediction) {
  const researchId = ITEM_RESEARCH_MAP[name];
  const ref = researchId ? getReference(researchId) : null;
  const evidenceLevel = ref?.evidenceLevel || 'C';
  const domainLabel = referenceDomainLabel(ref, prediction);
  const hc = computeHeuristicConfidence(prediction, evidenceLevel);
  return {
    name,
    rawRisk: risk,
    calibratedRisk: evidenceAdjustedRisk(risk, evidenceLevel),
    level,
    evidenceLevel,
    evidenceLabel: EVIDENCE_LABELS[evidenceLevel],
    confidence: hc,
    heuristicConfidence: hc,
    engineType: ENGINE_TYPE,
    referenceDomainLabel: domainLabel,
    metrics: ref?.metrics || [],
    thresholds: ref?.thresholds || {},
    references: ref?.references || [],
    evidenceChain: researchId ? buildEvidenceChain(researchId) : [],
    evidenceRationale: ref?.evidenceRationale || null,
    // deprecated aliases — do not display in UI
    engine: domainLabel,
    model: domainLabel,
    aiModel: domainLabel,
    ensembleConfidence: hc,
  };
}

function deriveConditionRisk(baseRisk, itemName, features) {
  let risk = baseRisk;
  if (itemName.includes('高血压') || itemName.includes('冠心病') || itemName.includes('心律')) {
    if (features.avg_hr > 85 || features.resting_hr > 80) risk += 12;
  }
  if (itemName.includes('糖尿病') || itemName.includes('活动')) {
    if (features.low_activity) risk += 10;
  }
  if (itemName.includes('肺') || itemName.includes('呼吸') || itemName.includes('SpO')) {
    if (features.spo2_below_threshold) risk += 15;
  }
  if (features.anomaly_flag) risk += 8;
  return Math.min(85, Math.max(5, Math.round(risk)));
}

function buildDomainWeightedSummaries(conditions) {
  return DOMAIN_WEIGHTS.map((m) => ({
    ...m,
    weightedSummary: conditions.reduce((s, c) => s + c.calibratedRisk * m.weight, 0) / Math.max(1, conditions.length),
    // deprecated alias
    vote: conditions.reduce((s, c) => s + c.calibratedRisk * m.weight, 0) / Math.max(1, conditions.length),
  }));
}

function attachLegacyEngineFields(result) {
  return {
    ...result,
    ensembleConfidence: result.heuristicConfidence,
    modelVotes: result.domainWeightedSummaries,
    models: result.domainWeightPlaceholders,
    legacyFieldsNote: LEGACY_FIELDS_NOTE,
  };
}

async function runFullAnalysis(patientData) {
  const store = patientData?.store || patientData?.wearableStore;
  const screening = patientData?.diseaseScreening || patientData?.screening;
  const stats = patientData?.dashboard?.stats || patientData?.stats || {};
  const profile = patientData?.profile || { name: 'Patient', age: 35, sex: 'M' };

  let prediction = null;
  let features = null;
  let inferenceBackend = null;

  if (store?.daily && Object.keys(store.daily).length) {
    features = extractFeatures({
      days: store.daily,
      targetDay: Object.keys(store.daily).sort().pop(),
    });
    try {
      if (!isModelLoaded()) await loadModel();
      prediction = await predictRisk(features);
      inferenceBackend = 'onnx-runtime';
    } catch (err) {
      inferenceBackend = 'feature-heuristic-fallback';
      prediction = {
        label: features.health_score_norm < 0.6 ? 'high' : features.health_score_norm < 0.75 ? 'moderate' : 'low',
        riskPercent: Math.round((1 - features.health_score_norm) * 60 + features.anomaly_flag * 15),
        confidence: 0.5,
        error: err.message,
      };
    }
  } else {
    inferenceBackend = 'insufficient-data';
    prediction = { label: 'unknown', riskPercent: 0, confidence: null };
  }

  const conditions = screening
    ? screening.categories.flatMap((cat) =>
      cat.items.map((item) => {
        const risk = deriveConditionRisk(
          prediction.riskPercent ?? item.risk ?? 20,
          item.name,
          features || {},
        );
        return analyzeCondition(item.name, risk, HIGH_LEVEL(risk), prediction);
      }),
    )
    : [];

  const domainWeightedSummaries = buildDomainWeightedSummaries(conditions);
  const heuristicConfidence = prediction?.confidence ?? 0.55;

  return attachLegacyEngineFields({
    version: 'MedWear-RuleEngine-v1',
    engineType: ENGINE_TYPE,
    inferenceBackend,
    generatedAt: new Date().toISOString(),
    patient: profile,
    heuristicConfidence,
    domainWeights: DOMAIN_WEIGHTS,
    domainWeightPlaceholders: DOMAIN_WEIGHTS.map((m) => ({ ...m, disclaimer: 'Configurable domain weight — not a trained model' })),
    domainWeightedSummaries,
    conditions,
    summary: screening?.summary,
    overallRisk: prediction.label,
    overallScore: prediction.riskPercent ?? screening?.overallScore ?? 0,
    optionalOnnxPrediction: inferenceBackend === 'onnx-runtime' ? prediction : null,
    modelInfo: getModelInfo(),
    fusionWeights: { wearable: 0.55, clinical: 0.30, behavioral: 0.15 },
    dataQuality: screening?.dataCoverage?.quality || 'from-wearable-store',
    disclaimer: LEGACY_FIELDS_NOTE,
    vitalsUsed: {
      heartRate: stats.heartRate,
      restingHR: stats.restingHR,
      spo2: stats.spo2,
      hrv: stats.hrv,
      steps: stats.steps,
      sleep: stats.sleepHours,
      bmi: profile.bmi,
    },
    featureVector: features,
  });
}

function enrichScreeningItem(item, ref, features, riskOverride) {
  const risk = riskOverride ?? item.risk ?? 20;
  const domainLabel = referenceDomainLabel(ref, null);
  const hc = computeHeuristicConfidence(null, ref?.evidenceLevel || 'C');
  return {
    ...item,
    risk,
    level: HIGH_LEVEL(risk),
    researchId: ref?.id,
    evidenceLevel: ref?.evidenceLevel,
    evidenceLabel: ref ? EVIDENCE_LABELS[ref.evidenceLevel] : undefined,
    evidenceRationale: ref?.evidenceRationale,
    engineType: ENGINE_TYPE,
    referenceDomainLabel: domainLabel,
    calibratedRisk: ref ? evidenceAdjustedRisk(risk, ref.evidenceLevel) : risk,
    heuristicConfidence: hc,
    confidence: hc,
    references: ref?.references,
  };
}

function enrichScreeningData(screening, store) {
  const base = { ...screening, aiVersion: 'MedWear-RuleEngine-v1', engineType: ENGINE_TYPE };
  if (!store?.daily) return enrichScreeningDataSync(screening);

  const days = Object.keys(store.daily).sort();
  const features = extractFeatures({ days: store.daily, targetDay: days[days.length - 1] });

  return {
    ...base,
    categories: screening.categories.map((cat) => ({
      ...cat,
      items: cat.items.map((item) => {
        const rid = ITEM_RESEARCH_MAP[item.name];
        const ref = rid ? getReference(rid) : null;
        const risk = deriveConditionRisk(
          item.risk ?? (features.health_score_norm < 0.65 ? 45 : 20),
          item.name,
          features,
        );
        return enrichScreeningItem(item, ref, features, risk);
      }),
    })),
  };
}

function enrichScreeningDataSync(screening) {
  return {
    ...screening,
    aiVersion: 'MedWear-RuleEngine-v1',
    engineType: ENGINE_TYPE,
    categories: (screening.categories || []).map((cat) => ({
      ...cat,
      items: cat.items.map((item) => {
        const rid = ITEM_RESEARCH_MAP[item.name];
        const ref = rid ? getReference(rid) : null;
        if (!ref) return { ...item, engineType: ENGINE_TYPE };
        return enrichScreeningItem(item, ref, null);
      }),
    })),
  };
}

module.exports = {
  ENGINE_TYPE,
  LEGACY_FIELDS_NOTE,
  DOMAIN_WEIGHTS,
  /** @deprecated use DOMAIN_WEIGHTS */
  MODELS: DOMAIN_WEIGHTS,
  ITEM_RESEARCH_MAP,
  runFullAnalysis,
  enrichScreeningData,
  enrichScreeningDataSync,
  analyzeCondition,
  evidenceAdjustedRisk,
  computeHeuristicConfidence,
  /** @deprecated */
  ensembleScore: evidenceAdjustedRisk,
  /** @deprecated */
  calibrateConfidence: computeHeuristicConfidence,
  getAllReferences,
  buildDomainWeightedSummaries,
  referenceDomainLabel,
};
