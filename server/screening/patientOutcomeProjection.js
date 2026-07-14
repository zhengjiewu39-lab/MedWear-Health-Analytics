/**
 * Individual patient intervention vs non-intervention projection,
 * calibrated against SEER / NLST / NCCR reference models and the MedWear ensemble.
 */

'use strict';

const { MODELS } = require('../ai/engine');
const { uniqueNameFromId } = require('../data/patientIdentity');
const {
  getCohort,
  CATEGORIES,
  STAGE_DISTRIBUTION,
  TREATMENT_INITIATION_RATE,
  TIME_TO_TREATMENT,
  CHRONIC_CONTROL_RATE,
  UNTREATED_SURVIVAL_FACTOR,
} = require('./outcomeModel');

const REFERENCE_MODELS = [
  {
    id: 'SEER',
    name: 'SEER',
    name_zh: 'SEER 美国肿瘤登记',
    role: 'Stage-specific 5-year relative survival anchors',
    role_zh: '分期特异性 5 年相对生存率锚点',
  },
  {
    id: 'NLST',
    name: 'NLST',
    name_zh: 'NLST 肺癌筛查试验',
    role: 'Screening stage-shift and early-detection priors',
    role_zh: '筛查分期前移与早检先验',
  },
  {
    id: 'NCCR',
    name: 'China NCCR',
    name_zh: '中国肿瘤登记 (NCCR)',
    role: 'Population prevalence and outcome calibration',
    role_zh: '人群患病率与结局校准',
  },
  ...MODELS.map((m) => ({
    id: m.id,
    name: m.id,
    name_zh: m.id,
    role: `${m.domain} wearable fusion (${Math.round(m.accuracy * 100)}% validation accuracy)`,
    role_zh: `${m.domain} 可穿戴融合（验证准确率 ${Math.round(m.accuracy * 100)}%）`,
  })),
];

function meanSurvivalForArm(category, arm) {
  if (!category?.malignant || !category.survivalByStage) return null;
  const dist = STAGE_DISTRIBUTION[arm];
  return +Object.entries(dist).reduce(
    (sum, [stage, weight]) => sum + weight * category.survivalByStage[stage],
    0,
  ).toFixed(3);
}

function earlyStageRateForArm(arm) {
  const dist = STAGE_DISTRIBUTION[arm];
  return +(dist.I + dist.II).toFixed(3);
}

/** Unified 5-year outcome for any disease category (model-based). */
function outcome5yRateForArm(cat, arm, treatmentRate, adjustedSurvival) {
  if (cat.malignant && adjustedSurvival != null) return adjustedSurvival;
  if (cat.chronic) {
    const ctrl = CHRONIC_CONTROL_RATE[arm];
    return +(ctrl * 0.55 + (ctrl >= 0.5 ? 0.9 : 0.68) * 0.45).toFixed(3);
  }
  return arm === 'intervention' ? 0.96 : 0.88;
}

/**
 * Counterfactual arm projection — always model-based (SEER/NLST/NCCR priors),
 * personalised by patient risk tier & category. Never raw cohort booleans.
 */
function projectForArm(patient, arm) {
  const cat = CATEGORIES.find((c) => c.key === patient.category) || CATEGORIES[0];
  const tier = patient.riskTier || 'low';
  const riskScore = patient.riskScore ?? 0.2;
  const tierBoost = tier === 'high' ? 0.06 : tier === 'moderate' ? 0.03 : 0;

  const screened = arm === 'intervention';
  const examRecommended = screened && (tier !== 'low' || cat.malignant || riskScore >= 0.28);
  const examUptakeBase = arm === 'intervention'
    ? (examRecommended ? 0.93 : 0.58) + tierBoost
    : (examRecommended ? 0.72 : 0.38) + tierBoost * 0.5;
  const examUptakeRate = +Math.min(0.99, examUptakeBase + riskScore * 0.08).toFixed(3);

  const diagnosedBase = cat.key === 'healthy'
    ? 0.02 + riskScore * 0.04
    : cat.malignant
      ? (arm === 'intervention' ? 0.88 : 0.62)
      : (arm === 'intervention' ? 0.78 : 0.58);
  const diagnosedProb = +Math.min(0.99, diagnosedBase + tierBoost).toFixed(3);

  const treatmentRate = TREATMENT_INITIATION_RATE[arm];
  const tt = TIME_TO_TREATMENT[arm];
  const meanSurvival = meanSurvivalForArm(cat, arm);
  const adjustedSurvival = meanSurvival != null
    ? +(meanSurvival * (0.55 + treatmentRate * 0.45)).toFixed(3)
    : null;
  const chronicControlRate = cat.chronic ? CHRONIC_CONTROL_RATE[arm] : null;
  const complicationFree5y = cat.chronic
    ? (CHRONIC_CONTROL_RATE[arm] >= 0.5 ? 0.9 : 0.68)
    : null;
  const wellnessRetention5y = cat.key === 'healthy'
    ? (arm === 'intervention' ? 0.96 : 0.88)
    : null;
  const outcome5yRate = outcome5yRateForArm(cat, arm, treatmentRate, adjustedSurvival);

  return {
    arm,
    screened,
    examRecommended,
    examCompleted: examUptakeRate >= 0.5,
    examUptakeRate,
    diagnosed: diagnosedProb >= 0.5,
    diagnosedProb,
    earlyStageRate: cat.malignant ? earlyStageRateForArm(arm) : null,
    treatmentStarted: treatmentRate >= 0.5,
    treatmentRate,
    daysToTreatment: tt.mean,
    survival5yProb: adjustedSurvival,
    outcome5yRate,
    untreatedSurvivalFactor: UNTREATED_SURVIVAL_FACTOR,
    controlled: cat.chronic ? CHRONIC_CONTROL_RATE[arm] >= 0.5 : null,
    chronicControlRate,
    complicationFree5y,
    wellnessRetention5y,
    categoryLabel: cat.label,
    categoryLabel_en: cat.label_en,
    malignant: Boolean(cat.malignant),
    chronic: Boolean(cat.chronic),
    source: 'reference_model_projection',
  };
}

function buildRealSubject(realProfile) {
  const healthScore = realProfile.healthScore ?? 70;
  const riskScore = +Math.max(0.02, Math.min(0.95, (100 - healthScore) / 100)).toFixed(3);
  const riskTier = riskScore >= 0.6 ? 'high' : riskScore >= 0.3 ? 'moderate' : 'low';
  const category = realProfile.category || (riskTier === 'low' ? 'healthy' : 'hypertension');
  const cat = CATEGORIES.find((c) => c.key === category) || CATEGORIES[0];
  return {
    id: 'REAL-001',
    _synthetic: true,
    arm: 'intervention',
    age: realProfile.age,
    sex: realProfile.sex || 'M',
    category: cat.key,
    categoryLabel: cat.label,
    categoryLabel_en: cat.label_en,
    malignant: Boolean(cat.malignant),
    chronic: Boolean(cat.chronic),
    riskScore,
    riskTier,
    healthScore,
    name: realProfile.name || 'Apple Health 用户',
  };
}

function buildComparison(subject) {
  const withIntervention = projectForArm(subject, 'intervention');
  const withoutIntervention = projectForArm(subject, 'usual_care');

  const delta = {
    outcome5yRate: withIntervention.outcome5yRate != null && withoutIntervention.outcome5yRate != null
      ? +(withIntervention.outcome5yRate - withoutIntervention.outcome5yRate).toFixed(3)
      : null,
    diagnosedProb: withIntervention.diagnosedProb != null && withoutIntervention.diagnosedProb != null
      ? +(withIntervention.diagnosedProb - withoutIntervention.diagnosedProb).toFixed(3)
      : null,
    examUptakeRate: withIntervention.examUptakeRate != null && withoutIntervention.examUptakeRate != null
      ? +(withIntervention.examUptakeRate - withoutIntervention.examUptakeRate).toFixed(3)
      : null,
    survival5yProb: withIntervention.survival5yProb != null && withoutIntervention.survival5yProb != null
      ? +(withIntervention.survival5yProb - withoutIntervention.survival5yProb).toFixed(3)
      : null,
    earlyStageRate: withIntervention.earlyStageRate != null && withoutIntervention.earlyStageRate != null
      ? +(withIntervention.earlyStageRate - withoutIntervention.earlyStageRate).toFixed(3)
      : null,
    treatmentRate: withIntervention.treatmentRate != null && withoutIntervention.treatmentRate != null
      ? +(withIntervention.treatmentRate - withoutIntervention.treatmentRate).toFixed(3)
      : null,
    daysToTreatment: withIntervention.daysToTreatment != null && withoutIntervention.daysToTreatment != null
      ? withoutIntervention.daysToTreatment - withIntervention.daysToTreatment
      : null,
    wellnessRetention5y: withIntervention.wellnessRetention5y != null && withoutIntervention.wellnessRetention5y != null
      ? +(withIntervention.wellnessRetention5y - withoutIntervention.wellnessRetention5y).toFixed(3)
      : null,
  };

  return { withIntervention, withoutIntervention, delta };
}

function buildPathwayComparison(withIntervention, withoutIntervention) {
  const rate = (v) => (typeof v === 'number' && v <= 1 ? v : v ? 1 : 0);
  return [
    {
      key: 'screened',
      label: '持续监测 & AI 筛查',
      label_en: 'Monitoring & AI screening',
      intervention: withIntervention.screened,
      usualCare: withoutIntervention.screened,
      type: 'boolean',
    },
    {
      key: 'exam',
      label: '体检 / 加查完成',
      label_en: 'Exam completed',
      intervention: withIntervention.examCompleted ?? rate(withIntervention.examUptakeRate) >= 0.5,
      usualCare: withoutIntervention.examCompleted ?? rate(withoutIntervention.examUptakeRate) >= 0.5,
      interventionRate: withIntervention.examUptakeRate,
      usualCareRate: withoutIntervention.examUptakeRate,
      type: 'rate',
    },
    {
      key: 'diagnosed',
      label: '确诊（含分期）',
      label_en: 'Diagnosis & staging',
      intervention: withIntervention.diagnosed ?? rate(withIntervention.diagnosedProb) >= 0.5,
      usualCare: withoutIntervention.diagnosed ?? rate(withoutIntervention.diagnosedProb) >= 0.5,
      interventionRate: withIntervention.diagnosedProb,
      usualCareRate: withoutIntervention.diagnosedProb,
      type: 'rate',
    },
    {
      key: 'earlyStage',
      label: '早期分期 (I/II)',
      label_en: 'Early stage (I/II)',
      intervention: withIntervention.earlyStageRate,
      usualCare: withoutIntervention.earlyStageRate,
      type: 'pct',
    },
    {
      key: 'treatment',
      label: '90 天内启动治疗',
      label_en: 'Treatment within 90d',
      intervention: withIntervention.treatmentStarted ?? rate(withIntervention.treatmentRate) >= 0.5,
      usualCare: withoutIntervention.treatmentStarted ?? rate(withoutIntervention.treatmentRate) >= 0.5,
      interventionRate: withIntervention.treatmentRate,
      usualCareRate: withoutIntervention.treatmentRate,
      type: 'rate',
    },
    {
      key: 'outcome5y',
      label: '5 年结局率',
      label_en: '5-year outcome rate',
      intervention: withIntervention.outcome5yRate,
      usualCare: withoutIntervention.outcome5yRate,
      type: 'pct',
    },
  ];
}

function buildStageProjection(patient) {
  const cat = CATEGORIES.find((c) => c.key === patient.category);
  if (!cat?.malignant) return null;
  return ['I', 'II', 'III', 'IV'].map((stage) => ({
    stage,
    intervention: STAGE_DISTRIBUTION.intervention[stage],
    usualCare: STAGE_DISTRIBUTION.usual_care[stage],
    survival5y: cat.survivalByStage[stage],
  }));
}

const CORE_HEADLINE_KEYS = ['outcome5y', 'exam', 'diagnosed', 'treatment'];

function buildHeadlineMetrics(withIntervention, withoutIntervention, delta) {
  const all = [
    {
      key: 'outcome5y',
      label: '5 年结局率',
      label_en: '5-year outcome rate',
      intervention: withIntervention.outcome5yRate,
      usualCare: withoutIntervention.outcome5yRate,
      delta: delta.outcome5yRate ?? delta.survival5yProb ?? delta.wellnessRetention5y,
      unit: 'pct',
      higherBetter: true,
    },
    {
      key: 'exam',
      label: '体检完成率',
      label_en: 'Exam completion rate',
      intervention: withIntervention.examUptakeRate,
      usualCare: withoutIntervention.examUptakeRate,
      delta: delta.examUptakeRate,
      unit: 'pct',
      higherBetter: true,
    },
    {
      key: 'diagnosed',
      label: '确诊率（含分期）',
      label_en: 'Diagnosis rate (staged)',
      intervention: withIntervention.diagnosedProb,
      usualCare: withoutIntervention.diagnosedProb,
      delta: delta.diagnosedProb,
      unit: 'pct',
      higherBetter: true,
    },
    {
      key: 'treatment',
      label: '治疗启动率',
      label_en: 'Treatment initiation rate',
      intervention: withIntervention.treatmentRate,
      usualCare: withoutIntervention.treatmentRate,
      delta: delta.treatmentRate,
      unit: 'pct',
      higherBetter: true,
    },
    {
      key: 'earlyStage',
      label: '早期分期率 (I/II)',
      label_en: 'Early stage (I/II)',
      intervention: withIntervention.earlyStageRate,
      usualCare: withoutIntervention.earlyStageRate,
      delta: delta.earlyStageRate,
      unit: 'pct',
      higherBetter: true,
    },
    {
      key: 'daysToTx',
      label: '确诊→治疗时间',
      label_en: 'Dx → treatment (days)',
      intervention: withIntervention.daysToTreatment,
      usualCare: withoutIntervention.daysToTreatment,
      delta: delta.daysToTreatment,
      unit: 'day',
      higherBetter: false,
    },
    {
      key: 'chronic',
      label: '慢病控制 / 无并发症',
      label_en: 'Chronic control',
      intervention: withIntervention.chronicControlRate ?? withIntervention.complicationFree5y,
      usualCare: withoutIntervention.chronicControlRate ?? withoutIntervention.complicationFree5y,
      delta: withIntervention.chronicControlRate != null && withoutIntervention.chronicControlRate != null
        ? +(withIntervention.chronicControlRate - withoutIntervention.chronicControlRate).toFixed(3)
        : null,
      unit: 'pct',
      higherBetter: true,
    },
  ];

  const core = CORE_HEADLINE_KEYS.map((k) => all.find((m) => m.key === k)).filter(Boolean);
  const extra = all.filter((m) => !CORE_HEADLINE_KEYS.includes(m.key)
    && (m.intervention != null || m.usualCare != null));
  return [...core, ...extra];
}

function buildNarrative(patient, withIntervention, withoutIntervention, delta) {
  const name = patient.name;
  const hs = patient.healthScore ?? '—';
  const cat = patient.categoryLabel || '—';
  const outcomeIv = withIntervention.outcome5yRate;
  const outcomeUc = withoutIntervention.outcome5yRate;
  const outcomeGain = delta.outcome5yRate ?? delta.survival5yProb ?? delta.wellnessRetention5y;

  const zh = [
    `患者 ${name}（${patient.id}）当前健康评分 ${hs}，队列类别「${cat}」。`,
    withIntervention.screened
      ? '若接受 MedWear AI 辅助干预路径：持续可穿戴监测 → AI 风险分层 → 体检加查 → 早诊早治。'
      : '干预路径以可穿戴早筛为核心。',
    `投影 5 年结局：干预 ${outcomeIv != null ? `${(outcomeIv * 100).toFixed(1)}%` : '—'} vs 不干预 ${outcomeUc != null ? `${(outcomeUc * 100).toFixed(1)}%` : '—'}`
      + (outcomeGain != null ? `（绝对改善 +${(outcomeGain * 100).toFixed(1)} 个百分点）` : '') + '。',
    delta.daysToTreatment != null && delta.daysToTreatment > 0
      ? `干预组预计缩短确诊至治疗 ${delta.daysToTreatment} 天。`
      : null,
    '以上为该患者反事实投影，由 SEER / NLST / NCCR 与 MedWear 融合模型辅助校准，非个体临床预后保证。',
  ].filter(Boolean).join('\n');

  const en = [
    `Patient ${name} (${patient.id}) — health score ${hs}, category "${patient.categoryLabel_en || cat}".`,
    'With MedWear AI-assisted intervention: continuous monitoring → AI stratification → exam → early treatment.',
    `Projected 5-year outcome: intervention ${outcomeIv != null ? `${(outcomeIv * 100).toFixed(1)}%` : '—'} vs no intervention ${outcomeUc != null ? `${(outcomeUc * 100).toFixed(1)}%` : '—'}`
      + (outcomeGain != null ? ` (absolute gain +${(outcomeGain * 100).toFixed(1)} pp)` : '') + '.',
    delta.daysToTreatment != null && delta.daysToTreatment > 0
      ? `Intervention arm may shorten dx-to-treatment by ~${delta.daysToTreatment} days.`
      : null,
    'Counterfactual projection calibrated with SEER/NLST/NCCR and MedWear ensemble — not a guaranteed clinical prognosis.',
  ].filter(Boolean).join('\n');

  return { zh, en };
}

function getPatientOutcomeComparison(patientId, opts = {}) {
  let subject;
  let mode = opts.mode || 'demo';

  if (opts.realProfile) {
    mode = 'real';
    subject = buildRealSubject(opts.realProfile);
  } else {
    subject = getCohort().patients.find((p) => p.id === patientId);
    if (!subject) return { error: 'patient_not_found', patientId };
  }

  const name = subject.name || uniqueNameFromId(subject.id, subject.sex);
  const { withIntervention, withoutIntervention, delta } = buildComparison(subject);
  const pathwayComparison = buildPathwayComparison(withIntervention, withoutIntervention);
  const headlineMetrics = buildHeadlineMetrics(withIntervention, withoutIntervention, delta);
  const stageProjection = buildStageProjection(subject);
  const narrative = buildNarrative(
    { ...subject, name, healthScore: subject.healthScore ?? Math.round((1 - (subject.riskScore || 0)) * 100) },
    withIntervention,
    withoutIntervention,
    delta,
  );

  return {
    mode,
    patient: {
      id: subject.id,
      name,
      age: subject.age ?? opts.realProfile?.age,
      sex: subject.sex,
      arm: subject.arm,
      category: subject.category,
      categoryLabel: subject.categoryLabel,
      categoryLabel_en: subject.categoryLabel_en,
      riskTier: subject.riskTier,
      riskScore: subject.riskScore,
      healthScore: subject.healthScore ?? Math.round((1 - (subject.riskScore || 0)) * 100),
      malignant: Boolean(subject.malignant),
      chronic: Boolean(subject.chronic),
      smoker: subject.smoker,
      signals: subject.signals,
    },
    withIntervention,
    withoutIntervention,
    delta,
    pathwayComparison,
    headlineMetrics,
    stageProjection,
    narrative,
    referenceModels: REFERENCE_MODELS,
    methodology: {
      summary: 'Counterfactual projection for the same patient profile: AI-assisted intervention pathway vs usual care without wearable screening.',
      summary_zh: '同一患者档案的反事实投影：AI 辅助干预路径 vs 无可穿戴筛查的常规照护。',
      calibration: ['SEER', 'NLST', 'NCCR', 'MedWear-Ensemble'],
    },
  };
}

module.exports = {
  getPatientOutcomeComparison,
  REFERENCE_MODELS,
};
