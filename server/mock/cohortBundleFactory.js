/**
 * Build clinical demo bundles for any member of the n=5000 screening-outcome cohort.
 */

'use strict';

const { getCohort } = require('../screening/outcomeModel');
const { filterPatients, toPatientRecord } = require('../screening/patientRegistry');

const COHORT_ID_RE = /^(IV|UC)-\d{4}$/;
const DEFAULT_COHORT_ID = 'IV-0001';

const LEGACY_ID_MAP = {
  'demo-001': 'IV-0008',
  'demo-002': 'IV-0033',
  'demo-003': 'IV-0018',
  'demo-004': 'IV-0204',
  'demo-005': 'IV-0019',
  'demo-006': 'IV-0027',
  'demo-007': 'IV-0005',
  'demo-008': 'IV-0007',
};

/** @type {object[]|null} */
let COHORT_RAW = null;

function loadCohortRaw() {
  if (!COHORT_RAW) COHORT_RAW = getCohort().patients;
  return COHORT_RAW;
}

function getCohortMember(id) {
  return loadCohortRaw().find((p) => p.id === id) || null;
}

function isValidCohortId(id) {
  return COHORT_ID_RE.test(id) && Boolean(getCohortMember(id));
}

function resolveCohortDemoId(id) {
  if (!id) return DEFAULT_COHORT_ID;
  const mapped = LEGACY_ID_MAP[id] || id;
  if (isValidCohortId(mapped)) return mapped;
  return DEFAULT_COHORT_ID;
}

function computeHealthScore(signals, riskScore) {
  const base = Math.round((1 - riskScore) * 52 + 38);
  const hrBonus = signals.restingHR >= 50 && signals.restingHR <= 75 ? 6 : 0;
  const spo2Bonus = signals.spo2 >= 96 ? 5 : 0;
  const stepsBonus = signals.steps >= 6000 ? 4 : 0;
  return Math.min(99, Math.max(38, base + hrBonus + spo2Bonus + stepsBonus));
}

function estimateDiastolic(systolic) {
  return Math.round(systolic * 0.62);
}

function estimateHrv(restingHR, age, signalHrv) {
  if (signalHrv) return Math.round(signalHrv);
  return Math.max(22, Math.round(72 - restingHR - age * 0.15));
}

const CATEGORY_BOOSTS = {
  healthy: {},
  hypertension: { '高血压': 1.8, '脑卒中': 1.5, '冠心病/心梗': 1.4 },
  diabetes: { '2 型糖尿病': 2.2, '慢性肾病': 1.7, '高血压': 1.5 },
  lung_cancer: { '肺结节/肺癌': 2.0, '慢性阻塞性肺病': 1.9, '社区获得性肺炎': 1.5 },
  colorectal_cancer: { '结直肠肿瘤': 2.0, '肝胆胰肿瘤': 1.4 },
  breast_cancer: { '乳腺癌': 2.0, '甲状腺结节': 1.5 },
};

function screeningParams(cohort) {
  const tier = cohort.riskTier;
  const score = Math.round(cohort.riskScore * 100);
  if (tier === 'high') {
    return {
      overallRisk: 'high',
      overallScore: Math.max(52, Math.min(78, score)),
      multiplier: 1.85 + cohort.riskScore * 0.5,
      predictionFactor: 1.65,
    };
  }
  if (tier === 'moderate') {
    return {
      overallRisk: 'moderate',
      overallScore: Math.max(32, Math.min(55, score)),
      multiplier: 1.35 + cohort.riskScore * 0.3,
      predictionFactor: 1.3,
    };
  }
  return {
    overallRisk: 'low',
    overallScore: Math.max(8, Math.min(28, score)),
    multiplier: 0.85 + cohort.riskScore * 0.2,
    predictionFactor: 0.85,
  };
}

function buildScreeningSummary(cohort, params) {
  const label = cohort.categoryLabel;
  const en = cohort.categoryLabel_en;
  if (cohort.category === 'healthy') {
    return {
      summary: '整体风险偏低，可穿戴指标处于同龄正常范围，建议维持生活方式并年度体检。',
      summary_en: 'Overall low risk; wearable metrics within age-matched normal range; maintain lifestyle and annual checkups.',
      insights: [],
    };
  }
  if (cohort.malignant) {
    return {
      summary: `${label}相关可穿戴代理信号异常，专项影像筛查与肿瘤标志物检测建议提前安排。`,
      summary_en: `Wearable proxy signals suggest ${en}-related risk; specialty imaging and tumor markers advised.`,
      insights: [],
    };
  }
  return {
    summary: `${label}相关指标偏离基线，慢病管理与生活方式干预建议纳入随访计划。`,
    summary_en: `${en}-related metrics deviate from baseline; chronic care and lifestyle intervention recommended.`,
    insights: [],
  };
}

function buildDetailedScreeningInsights(stats, cohort, record) {
  const tierZh = cohort.riskTier === 'high' ? '高风险' : cohort.riskTier === 'moderate' ? '中风险' : '低风险';
  const tierEn = cohort.riskTier === 'high' ? 'high risk' : cohort.riskTier === 'moderate' ? 'moderate risk' : 'low risk';
  const armZh = cohort.arm === 'intervention' ? '干预组（可穿戴早筛）' : '对照组（常规照护）';
  const armEn = cohort.arm === 'intervention' ? 'intervention (wearable screening)' : 'control (usual care)';
  const di = record.deviceIntegration || {};
  const riskPct = Math.round(cohort.riskScore * 100);
  const items = [];

  items.push({
    type: 'info',
    text: `【个体档案】${record.name}（${cohort.id}）· ${cohort.age} 岁 · ${record.gender || (cohort.sex === 'F' ? '女' : '男')} · ${armZh}`,
    text_en: `[Profile] ${record.name} (${cohort.id}) · age ${cohort.age} · ${cohort.sex === 'F' ? 'female' : 'male'} · ${armEn}`,
  });

  items.push({
    type: cohort.riskTier === 'low' ? 'positive' : 'warning',
    text: `【风险分层】综合风险指数 ${riskPct}/100（${tierZh}）· 健康分 ${stats.healthScore} · 队列类别：${cohort.categoryLabel}`,
    text_en: `[Risk stratification] composite index ${riskPct}/100 (${tierEn}) · health score ${stats.healthScore} · cohort: ${cohort.categoryLabel_en}`,
  });

  if (di.primaryDevice) {
    items.push({
      type: 'info',
      text: `【多设备融合】${di.fusionLabel || '多源融合'} · 主设备 ${di.primaryDevice}（共 ${di.deviceCount || di.devices?.length || 0} 台）· 融合数据质量 ${di.fusedQuality}%（单设备 ${di.singleQuality}%，准确率 +${Math.round((di.accuracyGain || 0) * 100)}%）`,
      text_en: `[Multi-device fusion] ${di.fusionLabel_en || 'fusion'} · primary ${di.primaryDevice_en || di.primaryDevice} (${di.deviceCount || 0} devices) · fused quality ${di.fusedQuality}% (single ${di.singleQuality}%, +${Math.round((di.accuracyGain || 0) * 100)}% accuracy)`,
    });
  }

  items.push({
    type: stats.restingHR > 80 || stats.restingHR < 55 ? 'warning' : 'positive',
    text: `【心血管】静息心率 ${stats.restingHR} bpm（参考 60–80）· HRV ${stats.hrv} ms · 收缩压 ${stats.systolic || '—'} mmHg · ${stats.restingHR > 80 ? '负荷偏高，建议动态血压与心电复测' : stats.restingHR < 60 ? '耐力良好，运动员型心率需排除病理' : '处于可接受范围'}`,
    text_en: `[Cardiovascular] resting HR ${stats.restingHR} bpm (ref 60–80) · HRV ${stats.hrv} ms · systolic ${stats.systolic || '—'} mmHg`,
  });

  items.push({
    type: stats.spo2 < 95 ? 'warning' : 'positive',
    text: `【呼吸】血氧 SpO₂ ${stats.spo2}%（参考 ≥95%）· 呼吸率 ${stats.respRate || 16} 次/分 · ${stats.spo2 < 95 ? '低于理想值，建议睡眠呼吸监测或肺功能评估' : '氧合稳定'}`,
    text_en: `[Respiratory] SpO₂ ${stats.spo2}% (ref ≥95%) · resp rate ${stats.respRate || 16}/min`,
  });

  items.push({
    type: stats.glucose > 6.1 || stats.glucose > 5.6 ? 'warning' : 'info',
    text: `【代谢】空腹血糖 ${stats.glucose} mmol/L · BMI ${stats.bmi || '—'} · ${stats.glucose > 6.1 ? '已达糖尿病筛查阈值，建议 HbA1c 与 OGTT' : stats.glucose > 5.6 ? '空腹血糖偏高，建议 3 个月复测' : '代谢指标在筛查参考范围内'}`,
    text_en: `[Metabolic] fasting glucose ${stats.glucose} mmol/L · BMI ${stats.bmi || '—'}`,
  });

  items.push({
    type: stats.steps < 5000 || stats.sleepHours < 6.5 ? 'warning' : 'positive',
    text: `【行为/恢复】日均步数 ${stats.steps}（目标 ≥8000）· 睡眠 ${stats.sleepHours} h · 压力 ${stats.stressLevel || '低'} · ${stats.steps < 5000 ? '活动不足，与慢病风险相关' : '活动量达标'}${stats.sleepHours < 6.5 ? '；睡眠不足影响 HRV 与免疫' : ''}`,
    text_en: `[Behavior/recovery] steps ${stats.steps}/day · sleep ${stats.sleepHours} h · stress ${stats.stressLevel || 'low'}`,
  });

  if (cohort.malignant) {
    items.push({
      type: 'warning',
      text: `【肿瘤早筛】${cohort.categoryLabel} 相关可穿戴代理信号异常 · 建议 30 天内完成专项影像（低剂量 CT / 肿瘤标志物）并纳入 ${armZh} 随访路径`,
      text_en: `[Oncology screening] ${cohort.categoryLabel_en}-related wearable signals abnormal · specialty imaging within 30 days`,
    });
  } else if (cohort.chronic) {
    items.push({
      type: 'warning',
      text: `【慢病管理】${cohort.categoryLabel} · 建议强化 14 天可穿戴监测窗口，对接慢病门诊与用药依从性评估`,
      text_en: `[Chronic care] ${cohort.categoryLabel_en} · 14-day enhanced wearable monitoring and chronic-care follow-up`,
    });
  } else {
    items.push({
      type: 'positive',
      text: '【健康维护】主要肿瘤与慢病间接指标处于低风险区间 · 建议维持当前生活方式并年度健康体检',
      text_en: '[Maintenance] tumor/chronic proxy indicators low · maintain lifestyle and annual checkup',
    });
  }

  if (cohort.arm === 'intervention') {
    items.push({
      type: 'info',
      text: '【研究路径】干预组：可穿戴异常窗口将自动汇入 AI 干预中心，医师审批后进入预约体检与结局随访',
      text_en: '[Study pathway] Intervention arm: wearable anomalies feed AI Intervention Hub → physician approval → exams & outcomes',
    });
  }

  items.push({
    type: 'info',
    text: '【下一步】完成本页 6 大类筛查复核 → 异常检测 → 预测分析 → AI 干预审批 → 医生报告',
    text_en: '[Next steps] Review 6 categories → anomaly detection → predictions → AI intervention approval → physician report',
  });

  return items;
}

function buildInsights(stats, cohort) {
  return buildDetailedScreeningInsights(
    { ...stats, systolic: stats.systolic, bmi: stats.bmi, respRate: stats.respRate },
    cohort,
    { name: '', deviceIntegration: {} },
  ).slice(3, 6);
}

function buildAnomalies(stats, cohort) {
  const list = [];
  const s = cohort.signals;
  if (s.spo2 < 95) {
    list.push({
      id: 1, type: '血氧饱和度下降', confidence: 85,
      detectedAt: '2024-06-26 15:00', pattern: `日间 SpO₂ ${stats.spo2}%，低于个人基线`,
      severity: s.spo2 < 94 ? 'high' : 'medium', status: 'investigating', aiModel: 'analyticsCore',
    });
  }
  if (stats.restingHR > 82) {
    list.push({
      id: list.length + 1, type: '静息心率偏高', confidence: 78,
      detectedAt: '2024-06-26 07:00', pattern: `晨间静息心率 ${stats.restingHR} bpm，高于基线`,
      severity: 'medium', status: 'monitoring', aiModel: 'analyticsCore',
    });
  }
  if (stats.hrv < 35) {
    list.push({
      id: list.length + 1, type: 'HRV 持续偏低', confidence: 82,
      detectedAt: '2024-06-26 06:30', pattern: `HRV ${stats.hrv} ms，自主神经恢复不足`,
      severity: cohort.riskTier === 'high' ? 'high' : 'medium', status: 'monitoring', aiModel: 'analyticsCore',
    });
  }
  if (stats.steps < 4500) {
    list.push({
      id: list.length + 1, type: '活动量不足', confidence: 76,
      detectedAt: '2024-06-25 20:00', pattern: `7 天平均步数 ${stats.steps}，低于同龄均值`,
      severity: 'medium', status: 'monitoring', aiModel: 'analyticsCore',
    });
  }
  if (stats.sleepHours < 6.2) {
    list.push({
      id: list.length + 1, type: '睡眠碎片化', confidence: 80,
      detectedAt: '2024-06-26 04:00', pattern: `平均睡眠 ${stats.sleepHours}h，深睡占比下降`,
      severity: 'medium', status: 'monitoring', aiModel: 'analyticsCore',
    });
  }
  return list.slice(0, 3);
}

function buildAlerts(anomalies, stats) {
  if (!anomalies.length) {
    return [{ id: 1, type: '监测正常', severity: 'info', message: '近 7 天主要指标稳定', time: '09:00', status: 'resolved' }];
  }
  return anomalies.slice(0, 2).map((a, i) => ({
    id: i + 1,
    type: a.type,
    severity: a.severity === 'high' ? 'high' : 'medium',
    message: a.pattern,
    time: '08:30',
    status: 'new',
  }));
}

function buildPatientSpec(cohort) {
  const record = toPatientRecord(cohort);
  const s = cohort.signals;
  const restingHR = Math.round(s.restingHR);
  const spo2 = Math.round(s.spo2 * 10) / 10;
  const steps = Math.round(s.steps);
  const sleepHours = +(s.sleepHours).toFixed(1);
  const glucose = +(s.fastingGlucose || 5.2).toFixed(1);
  const systolic = Math.round(s.systolicBP || (118 + Math.max(0, restingHR - 68)));
  const hrv = estimateHrv(restingHR, cohort.age, s.hrv);
  const healthScore = computeHealthScore(s, cohort.riskScore);
  const height = cohort.sex === 'F' ? 162 : 172;
  const bmiVal = +(s.bmi || 23.5).toFixed(1);
  const weight = Math.round(bmiVal * ((height / 100) ** 2));
  const screen = screeningParams(cohort);
  const narrative = buildScreeningSummary(cohort, screen);
  const stats = {
    healthScore,
    heartRate: restingHR + 8,
    restingHR,
    spo2,
    hrv,
    steps,
    sleepHours,
    stressLevel: cohort.riskTier === 'high' ? '高' : cohort.riskTier === 'moderate' ? '中' : '低',
    exerciseMinutes: steps >= 9000 ? 45 : steps >= 6000 ? 28 : 16,
    standHours: steps >= 8000 ? 10 : 8,
    glucose,
    systolic,
    bmi: bmiVal,
    respRate: Math.round(s.respRate || 16),
  };
  const detailedInsights = buildDetailedScreeningInsights(stats, cohort, record);
  const anomalies = buildAnomalies(stats, cohort);
  const scenario = `${cohort.categoryLabel} · ${cohort.riskTier === 'high' ? '高风险' : cohort.riskTier === 'moderate' ? '中风险' : '低风险'}`;
  const scenarioEn = `${cohort.categoryLabel_en} · ${cohort.riskTier} risk`;

  return {
    id: cohort.id,
    cohortId: cohort.id,
    scenario,
    scenario_en: scenarioEn,
    profile: {
      name: record.name,
      age: cohort.age,
      gender: cohort.sex === 'F' ? '女' : '男',
      height,
      weight,
      scenario,
      scenario_en: scenarioEn,
    },
    stats,
    bp: { systolic, diastolic: estimateDiastolic(systolic) },
    glucose,
    respRate: Math.round(s.respRate || 16),
    screening: {
      overallScore: screen.overallScore,
      overallRisk: screen.overallRisk,
      multiplier: screen.multiplier,
      boosts: CATEGORY_BOOSTS[cohort.category] || {},
      ...narrative,
      insights: detailedInsights,
    },
    predictionFactor: screen.predictionFactor,
    predictionCount: cohort.riskTier === 'low' ? 5 : 7,
    insights: detailedInsights,
    alerts: buildAlerts(anomalies, stats),
    anomalies,
    readinessFactors: anomalies.length
      ? ['需持续监测', cohort.arm === 'intervention' ? '干预组随访' : '对照组观察']
      : ['指标稳定', '可按计划活动'],
    reportSummary: narrative.summary,
    recommendations: cohort.malignant
      ? ['安排专项肿瘤筛查套餐', '2 周内复核可穿戴异常窗口']
      : cohort.chronic
        ? ['慢病门诊随访', '强化可穿戴监测 14 天']
        : ['维持当前生活方式', '年度健康体检'],
    cohortMeta: {
      arm: cohort.arm,
      category: cohort.category,
      categoryLabel: cohort.categoryLabel,
      categoryLabel_en: cohort.categoryLabel_en,
      riskTier: cohort.riskTier,
      riskScore: cohort.riskScore,
      malignant: cohort.malignant,
      chronic: cohort.chronic,
    },
    deviceIntegration: record.deviceIntegration,
  };
}

function buildSpecForId(patientId) {
  const id = resolveCohortDemoId(patientId);
  const cohort = getCohortMember(id);
  if (!cohort) return null;
  return buildPatientSpec(cohort);
}

function searchDemoPatients(opts = {}) {
  const limit = Math.min(Number(opts.limit) || 30, 100);
  const offset = Math.max(Number(opts.offset) || 0, 0);
  const result = filterPatients(undefined, {
    q: opts.q,
    arm: opts.arm,
    riskTier: opts.riskTier,
    limit,
    offset,
  });
  return {
    total: result.total,
    patients: result.patients.map((p) => ({
      id: p.id,
      name: p.name,
      age: p.age,
      gender: p.gender,
      healthScore: p.healthScore,
      overallRisk: p.riskTier,
      scenario: p.categoryLabel,
      scenario_en: p.categoryLabel_en,
      arm: p.arm,
      category: p.category,
      riskTier: p.riskTier,
      primaryDevice: p.deviceIntegration?.primaryDevice,
      primaryDevice_en: p.deviceIntegration?.primaryDevice_en,
      deviceCount: p.devices,
      fusionLabel: p.deviceIntegration?.fusionLabel,
      fusionLabel_en: p.deviceIntegration?.fusionLabel_en,
    })),
  };
}

function getDemoPatientSummary(patientId) {
  const id = resolveCohortDemoId(patientId);
  const result = filterPatients(undefined, { q: id, limit: 5 });
  const p = result.patients.find((x) => x.id === id);
  if (!p) return null;
  return {
    id: p.id,
    name: p.name,
    age: p.age,
    gender: p.gender,
    healthScore: p.healthScore,
    overallRisk: p.riskTier,
    scenario: p.categoryLabel,
    scenario_en: p.categoryLabel_en,
    arm: p.arm,
  };
}

module.exports = {
  DEFAULT_COHORT_ID,
  LEGACY_ID_MAP,
  COHORT_ID_RE,
  getCohortMember,
  isValidCohortId,
  resolveCohortDemoId,
  buildPatientSpec,
  buildSpecForId,
  searchDemoPatients,
  getDemoPatientSummary,
};
