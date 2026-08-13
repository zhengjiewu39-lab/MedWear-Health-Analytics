/**
 * MedWear evidence-weighted rule engine — domain placeholders + optional ONNX backend.
 * Primary API fields use BHI / attention-signal naming; legacy risk aliases are compatibility-only.
 */
const { getReference, getAllReferences, EVIDENCE_LABELS } = require('../data/researchReferences');
const { extractFeatures } = require('../services/extractFeatures');
const { predictRisk, isModelLoaded, getModelInfo, loadModel } = require('./onnxInference');
const { isOnnxEnabled } = require('../config/onnxConfig');

const ENGINE_TYPE = 'evidence-weighted-rule-engine';
const LEGACY_FIELDS_NOTE =
  'Deprecated aliases: overallRisk/overallRiskTier = BHI tier string; overallRiskScore = numeric (use overallScore); item risk/calibratedRisk = attention scores; heuristicConfidence = heuristicSupport.';

/** Configurable presentation weights — not learned coefficients; not externally validated. */
const FUSION_WEIGHTS = Object.freeze({
  wearable: 0.55,
  clinical: 0.30,
  behavioral: 0.15,
});
const FUSION_WEIGHTS_DISCLAIMER_EN =
  'Configurable presentation weights selected for prototype demonstration — not learned coefficients and not externally validated.';
const FUSION_WEIGHTS_DISCLAIMER_ZH =
  '原型演示用可配置展示权重 — 非学习系数，未经外部验证。';

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

const SIGNAL_LEVEL = (score) => (score >= 55 ? 'high' : score >= 35 ? 'moderate' : 'low');

function evidenceAdjustedAttentionScore(score, evidenceLevel) {
  const evidenceFactor = { A: 1.0, B: 0.97, C: 0.92 }[evidenceLevel] || 0.9;
  return Math.round(score * evidenceFactor * 10) / 10;
}

function computeHeuristicSupport(_prediction, evidenceLevel) {
  const base = 0.55;
  const evidenceBoost = { A: 0.04, B: 0.02, C: 0.01 }[evidenceLevel] || 0;
  return Math.min(0.85, Math.max(0.45, base + evidenceBoost));
}

function attachScreeningSignalAliases(signal) {
  const attentionScore = signal.attentionScore;
  const evidenceAdjustedAttentionScoreVal = signal.evidenceAdjustedAttentionScore;
  const signalLevel = signal.signalLevel;
  const heuristicSupport = signal.heuristicSupport;
  return {
    ...signal,
    attentionScore,
    evidenceAdjustedAttentionScore: evidenceAdjustedAttentionScoreVal,
    signalLevel,
    heuristicSupport,
    ruleSupportScore: heuristicSupport,
    evidenceDisplayWeight: heuristicSupport,
    rawRisk: attentionScore,
    risk: attentionScore,
    calibratedRisk: evidenceAdjustedAttentionScoreVal,
    level: signalLevel,
    heuristicConfidence: heuristicSupport,
    confidence: heuristicSupport,
    ensembleConfidence: heuristicSupport,
  };
}

const LEGACY_TIER_VALUES = new Set(['low', 'moderate', 'medium', 'high', 'unknown']);

function isLegacyTierString(value) {
  return typeof value === 'string' && LEGACY_TIER_VALUES.has(value.toLowerCase());
}

function normalizeLegacyTier(value) {
  if (value == null) return 'unknown';
  const s = String(value).toLowerCase();
  if (s === 'medium') return 'moderate';
  return LEGACY_TIER_VALUES.has(s) ? s : 'unknown';
}

function tierFromOverallScore(score) {
  if (score == null || Number.isNaN(Number(score))) return 'unknown';
  const n = Number(score);
  return n >= 80 ? 'low' : n >= 60 ? 'moderate' : 'high';
}

/** Resolve overallBhiTier + overallScore from primary or legacy screening fields. */
function resolveOverallScreeningFields(screening = {}) {
  const rawTier = screening.overallBhiTier;
  const rawRisk = screening.overallRisk;
  const rawScore = screening.overallScore;

  if (rawTier != null && isLegacyTierString(rawTier)) {
    return {
      overallBhiTier: normalizeLegacyTier(rawTier),
      overallScore: rawScore ?? 0,
    };
  }

  if (typeof rawRisk === 'number' && Number.isFinite(rawRisk)) {
    return {
      overallBhiTier: tierFromOverallScore(rawRisk),
      overallScore: rawRisk,
    };
  }

  if (typeof rawRisk === 'string' && rawRisk !== '' && !isLegacyTierString(rawRisk)) {
    const parsed = Number(rawRisk);
    if (Number.isFinite(parsed)) {
      return {
        overallBhiTier: tierFromOverallScore(parsed),
        overallScore: parsed,
      };
    }
  }

  if (isLegacyTierString(rawRisk)) {
    return {
      overallBhiTier: normalizeLegacyTier(rawRisk),
      overallScore: rawScore ?? 0,
    };
  }

  return {
    overallBhiTier: 'unknown',
    overallScore: rawScore ?? 0,
  };
}

function attachAnalysisResultAliases(result) {
  const tier = result.overallBhiTier;
  const score = result.overallScore;
  return {
    ...result,
    overallBhiTier: tier,
    heuristicSupport: result.heuristicSupport,
    ruleSupportScore: result.heuristicSupport,
    /** @deprecated tier string — same as historical mock diseaseScreening.overallRisk */
    overallRiskTier: tier,
    overallRisk: tier,
    /** @deprecated numeric alias — prefer overallScore (some callers misread overallRisk as a score) */
    overallRiskScore: score,
    heuristicConfidence: result.heuristicSupport,
    ensembleConfidence: result.heuristicSupport,
  };
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

function analyzeCondition(name, attentionScore, signalLevel, prediction) {
  const researchId = ITEM_RESEARCH_MAP[name];
  const ref = researchId ? getReference(researchId) : null;
  const evidenceLevel = ref?.evidenceLevel || 'C';
  const domainLabel = referenceDomainLabel(ref, prediction);
  const support = computeHeuristicSupport(prediction, evidenceLevel);
  return attachScreeningSignalAliases({
    name,
    attentionScore,
    evidenceAdjustedAttentionScore: evidenceAdjustedAttentionScore(attentionScore, evidenceLevel),
    signalLevel,
    evidenceLevel,
    evidenceLabel: EVIDENCE_LABELS[evidenceLevel],
    engineType: ENGINE_TYPE,
    referenceDomainLabel: domainLabel,
    metrics: ref?.metrics || [],
    thresholds: ref?.thresholds || {},
    references: ref?.references || [],
    evidenceChain: researchId ? buildEvidenceChain(researchId) : [],
    evidenceRationale: ref?.evidenceRationale || null,
    heuristicSupport: support,
    engine: domainLabel,
    model: domainLabel,
    aiModel: domainLabel,
  });
}

function deriveBaselineAttentionScore(item, features) {
  if (item?.attentionScore != null) return item.attentionScore;
  if (item?.risk != null) return item.risk;
  if (!features || features.health_score_norm == null) return 20;
  return features.health_score_norm < 0.65 ? 45 : 20;
}

function deriveConditionAttentionScore(baseScore, itemName, features) {
  let score = baseScore;
  if (itemName.includes('高血压') || itemName.includes('冠心病') || itemName.includes('心律')) {
    if (features.avg_hr > 85 || features.resting_hr > 80) score += 12;
  }
  if (itemName.includes('糖尿病') || itemName.includes('活动')) {
    if (features.low_activity) score += 10;
  }
  if (itemName.includes('肺') || itemName.includes('呼吸') || itemName.includes('SpO')) {
    if (features.spo2_below_threshold) score += 15;
  }
  if (features.anomaly_flag) score += 8;
  return Math.min(85, Math.max(5, Math.round(score)));
}

/** @deprecated use deriveConditionAttentionScore */
const deriveConditionRisk = deriveConditionAttentionScore;

function ruleEngineBhiFromFeatures(features) {
  if (!features || features.health_score_norm == null) {
    return { label: 'unknown', score: 0 };
  }
  const score = Math.round(features.health_score_norm * 100);
  const label = features.health_score_norm >= 0.8 ? 'low' : features.health_score_norm >= 0.6 ? 'moderate' : 'high';
  return { label, score };
}

function buildDomainWeightedSummaries(conditions) {
  return DOMAIN_WEIGHTS.map((m) => ({
    ...m,
    weightedSummary: conditions.reduce((s, c) => s + c.evidenceAdjustedAttentionScore * m.weight, 0) / Math.max(1, conditions.length),
    vote: conditions.reduce((s, c) => s + c.evidenceAdjustedAttentionScore * m.weight, 0) / Math.max(1, conditions.length),
  }));
}

function attachLegacyEngineFields(result) {
  return attachAnalysisResultAliases({
    ...result,
    modelVotes: result.domainWeightedSummaries,
    models: result.domainWeightPlaceholders,
    legacyFieldsNote: LEGACY_FIELDS_NOTE,
  });
}

function buildFeatureHeuristicPrediction(features) {
  return {
    label: features.health_score_norm < 0.6 ? 'high' : features.health_score_norm < 0.75 ? 'moderate' : 'low',
    riskPercent: Math.round((1 - features.health_score_norm) * 60 + features.anomaly_flag * 15),
    confidence: 0.5,
    source: 'feature-heuristic-fallback',
  };
}

async function tryOptionalOnnxInference(features) {
  if (!isOnnxEnabled()) return null;
  try {
    if (!isModelLoaded()) {
      const loaded = await loadModel();
      if (!loaded) return null;
    }
    const pred = await predictRisk(features);
    return pred ? { ...pred, purpose: 'experimental-bhi-tier-comparison-only' } : null;
  } catch {
    return null;
  }
}

async function runFullAnalysis(patientData) {
  const store = patientData?.store || patientData?.wearableStore;
  const screening = patientData?.diseaseScreening || patientData?.screening;
  const stats = patientData?.dashboard?.stats || patientData?.stats || {};
  const profile = patientData?.profile || { name: 'Patient', age: 35, sex: 'M' };

  let features = null;
  let inferenceBackend = null;
  let experimentalBhiTierComparison = null;
  let ruleBhi = { label: 'unknown', score: 0 };

  if (store?.daily && Object.keys(store.daily).length) {
    features = extractFeatures({
      days: store.daily,
      targetDay: Object.keys(store.daily).sort().pop(),
    });
    ruleBhi = ruleEngineBhiFromFeatures(features);
    experimentalBhiTierComparison = await tryOptionalOnnxInference(features);
    if (experimentalBhiTierComparison) {
      inferenceBackend = 'onnx-runtime';
    } else if (isOnnxEnabled()) {
      inferenceBackend = 'feature-heuristic-fallback';
    } else {
      inferenceBackend = 'rule-engine-only';
    }
  } else {
    inferenceBackend = 'insufficient-data';
  }

  const conditions = screening
    ? screening.categories.flatMap((cat) =>
      cat.items.map((item) => {
        const attentionScore = deriveConditionAttentionScore(
          deriveBaselineAttentionScore(item, features),
          item.name,
          features || {},
        );
        return {
          ...analyzeCondition(item.name, attentionScore, SIGNAL_LEVEL(attentionScore), null),
          signalKind: 'attention-not-diagnosis',
          signalLabel_zh: '需进一步评估的信号',
          signalLabel_en: 'Signal for further evaluation',
        };
      }),
    )
    : [];

  const domainWeightedSummaries = buildDomainWeightedSummaries(conditions);
  const heuristicSupport = 0.55;

  return attachLegacyEngineFields({
    version: 'MedWear-RuleEngine-v1',
    engineType: ENGINE_TYPE,
    inferenceBackend,
    onnxEnabled: isOnnxEnabled(),
    generatedAt: new Date().toISOString(),
    patient: profile,
    heuristicSupport,
    domainWeights: DOMAIN_WEIGHTS,
    domainWeightPlaceholders: DOMAIN_WEIGHTS.map((m) => ({ ...m, disclaimer: 'Configurable domain weight — not a trained model' })),
    domainWeightedSummaries,
    conditions,
    summary: screening?.summary,
    overallBhiTier: ruleBhi.label,
    overallScore: ruleBhi.score ?? screening?.overallScore ?? 0,
    experimentalBhiTierComparison,
    optionalOnnxPrediction: experimentalBhiTierComparison,
    usesOnnx: Boolean(experimentalBhiTierComparison),
    modelInfo: isOnnxEnabled() ? getModelInfo() : null,
    fusionWeights: { ...FUSION_WEIGHTS },
    fusionWeightsDisclaimer_en: FUSION_WEIGHTS_DISCLAIMER_EN,
    fusionWeightsDisclaimer_zh: FUSION_WEIGHTS_DISCLAIMER_ZH,
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

function enrichScreeningItem(item, ref, features, scoreOverride) {
  const attentionScore = scoreOverride ?? item.attentionScore ?? item.risk ?? 20;
  const domainLabel = referenceDomainLabel(ref, null);
  const support = computeHeuristicSupport(null, ref?.evidenceLevel || 'C');
  return attachScreeningSignalAliases({
    ...item,
    attentionScore,
    signalLevel: SIGNAL_LEVEL(attentionScore),
    researchId: ref?.id,
    evidenceLevel: ref?.evidenceLevel,
    evidenceLabel: ref ? EVIDENCE_LABELS[ref.evidenceLevel] : undefined,
    evidenceRationale: ref?.evidenceRationale,
    engineType: ENGINE_TYPE,
    referenceDomainLabel: domainLabel,
    evidenceAdjustedAttentionScore: ref ? evidenceAdjustedAttentionScore(attentionScore, ref.evidenceLevel) : attentionScore,
    heuristicSupport: support,
    references: ref?.references,
  });
}

function normalizeScreeningItem(item) {
  if (!item) return item;
  const attentionScore = item.attentionScore ?? item.risk ?? 20;
  const signalLevel = item.signalLevel ?? item.level ?? SIGNAL_LEVEL(attentionScore);
  const evidenceAdjustedAttentionScore = item.evidenceAdjustedAttentionScore ?? item.calibratedRisk ?? attentionScore;
  const heuristicSupport = item.heuristicSupport ?? item.heuristicConfidence ?? item.confidence ?? 0.55;
  return attachScreeningSignalAliases({
    ...item,
    attentionScore,
    signalLevel,
    evidenceAdjustedAttentionScore,
    heuristicSupport,
    signalKind: item.signalKind || 'attention-not-diagnosis',
    signalLabel_zh: item.signalLabel_zh || '需进一步评估的信号',
    signalLabel_en: item.signalLabel_en || 'Signal for further evaluation',
  });
}

function normalizeScreeningEnvelope(screening) {
  if (!screening) return screening;
  const { overallBhiTier, overallScore } = resolveOverallScreeningFields(screening);
  return attachAnalysisResultAliases({
    ...screening,
    overallBhiTier,
    overallScore,
    categories: (screening.categories || []).map((cat) => ({
      ...cat,
      items: (cat.items || []).map((item) => normalizeScreeningItem(item)),
    })),
  });
}

function enrichScreeningData(screening, store) {
  const base = normalizeScreeningEnvelope({ ...screening, aiVersion: 'MedWear-RuleEngine-v1', engineType: ENGINE_TYPE });
  if (!store?.daily) return enrichScreeningDataSync(screening);

  const days = Object.keys(store.daily).sort();
  const features = extractFeatures({ days: store.daily, targetDay: days[days.length - 1] });

  return normalizeScreeningEnvelope({
    ...base,
    categories: screening.categories.map((cat) => ({
      ...cat,
      items: cat.items.map((item) => {
        const rid = ITEM_RESEARCH_MAP[item.name];
        const ref = rid ? getReference(rid) : null;
        const attentionScore = deriveConditionAttentionScore(
          deriveBaselineAttentionScore(item, features),
          item.name,
          features,
        );
        return {
          ...enrichScreeningItem(item, ref, features, attentionScore),
          signalKind: 'attention-not-diagnosis',
          signalLabel_zh: '需进一步评估的信号',
          signalLabel_en: 'Signal for further evaluation',
        };
      }),
    })),
  });
}

function enrichScreeningDataSync(screening) {
  return normalizeScreeningEnvelope({
    ...screening,
    aiVersion: 'MedWear-RuleEngine-v1',
    engineType: ENGINE_TYPE,
    categories: (screening.categories || []).map((cat) => ({
      ...cat,
      items: cat.items.map((item) => {
        const rid = ITEM_RESEARCH_MAP[item.name];
        const ref = rid ? getReference(rid) : null;
        if (!ref) return normalizeScreeningItem({ ...item, engineType: ENGINE_TYPE });
        return enrichScreeningItem(item, ref, null);
      }),
    })),
  });
}

module.exports = {
  ENGINE_TYPE,
  LEGACY_FIELDS_NOTE,
  FUSION_WEIGHTS,
  FUSION_WEIGHTS_DISCLAIMER_EN,
  FUSION_WEIGHTS_DISCLAIMER_ZH,
  DOMAIN_WEIGHTS,
  MODELS: DOMAIN_WEIGHTS,
  ITEM_RESEARCH_MAP,
  runFullAnalysis,
  enrichScreeningData,
  enrichScreeningDataSync,
  normalizeScreeningEnvelope,
  resolveOverallScreeningFields,
  normalizeScreeningItem,
  analyzeCondition,
  evidenceAdjustedAttentionScore,
  evidenceAdjustedRisk: evidenceAdjustedAttentionScore,
  computeHeuristicSupport,
  computeHeuristicConfidence: computeHeuristicSupport,
  ensembleScore: evidenceAdjustedAttentionScore,
  calibrateConfidence: computeHeuristicSupport,
  getAllReferences,
  buildDomainWeightedSummaries,
  referenceDomainLabel,
  buildFeatureHeuristicPrediction,
  tryOptionalOnnxInference,
  deriveBaselineAttentionScore,
  deriveConditionAttentionScore,
  deriveConditionRisk,
  ruleEngineBhiFromFeatures,
  attachScreeningSignalAliases,
  isOnnxEnabled,
};
