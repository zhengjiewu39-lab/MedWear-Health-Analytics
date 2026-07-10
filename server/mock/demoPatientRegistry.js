/**
 * Demo-mode clinical bundles — all n=5000 cohort members supported on demand.
 */

'use strict';

const {
  DEFAULT_COHORT_ID,
  resolveCohortDemoId,
  buildSpecForId,
  searchDemoPatients,
  getDemoPatientSummary,
} = require('./cohortBundleFactory');

const {
  getExtendedCategories, getDemoTrendData, getRecommendedExams, getRecommendedExamsEn,
} = require('../data/screeningCatalog');
const { getDemoPredictions } = require('../data/predictionsCatalog');
const { getDemoFacilities } = require('../data/medicalFacilities');
const {
  STANDARDS, todayVitalsTrend, weekTrend, monthHealthScore,
} = require('./clinicalData');

const DEFAULT_ID = DEFAULT_COHORT_ID;
const MAX_BUNDLE_CACHE = 120;

/** @type {Map<string, object>} */
const BUNDLES = new Map();
/** @type {Map<string, object[]>} */
const APPOINTMENTS = new Map();

function bmi(height, weight) {
  return +((weight / ((height / 100) ** 2)).toFixed(1));
}

function grade(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B+';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  return 'D';
}

function scaleCategories(base, multiplier, boosts = {}) {
  return base.map((cat) => {
    const score = Math.min(92, Math.round(cat.score * multiplier));
    const riskLevel = score >= 55 ? 'high' : score >= 35 ? 'moderate' : cat.riskLevel;
    return {
      ...cat,
      score,
      riskLevel,
      items: cat.items.map((item) => {
        const boost = boosts[item.name] || 1;
        const risk = Math.min(92, Math.round(item.risk * multiplier * boost));
        const level = risk >= 50 ? 'high' : risk >= 30 ? 'moderate' : 'low';
        return { ...item, risk, level };
      }),
    };
  });
}

function scalePredictions(base, factor, keep = 6) {
  return base.map((p, i) => {
    if (i >= keep) return null;
    const probability = Math.min(88, Math.round(p.probability * factor));
    const level = probability >= 45 ? 'high' : probability >= 30 ? 'medium' : 'low';
    return { ...p, id: i + 1, probability, level };
  }).filter(Boolean);
}

function buildOrganScores(stats) {
  const cardio = Math.min(98, Math.round(70 + (80 - stats.restingHR) * 0.8 + stats.hrv * 0.2));
  const resp = Math.min(98, Math.round(stats.spo2 * 0.95));
  const sleep = Math.min(95, Math.round(60 + stats.sleepHours * 4));
  const metabolic = Math.min(95, Math.round(55 + (stats.steps / 200)));
  return [
    { name: '心血管', score: cardio, status: cardio >= 80 ? 'good' : 'moderate' },
    { name: '呼吸系统', score: resp, status: resp >= 90 ? 'excellent' : 'moderate' },
    { name: '睡眠质量', score: sleep, status: sleep >= 75 ? 'good' : 'moderate' },
    { name: '运动恢复', score: Math.round(stats.hrv + 20), status: stats.hrv >= 45 ? 'good' : 'moderate' },
    { name: '代谢健康', score: metabolic, status: metabolic >= 75 ? 'good' : 'moderate' },
    { name: '压力水平', score: Math.max(40, 90 - stats.restingHR), status: stats.restingHR < 75 ? 'good' : 'moderate' },
  ];
}

function appendCategoryScreeningInsights(base, categories) {
  const extra = [];
  categories.forEach((cat) => {
    const top = [...(cat.items || [])]
      .filter((i) => i.level === 'high' || i.level === 'moderate')
      .sort((a, b) => b.risk - a.risk)[0];
    if (top && top.risk >= 22) {
      extra.push({
        type: top.level === 'high' ? 'warning' : 'info',
        text: `【${cat.name}】${top.name} 融合校准风险 ${top.calibratedRisk ?? top.risk}%（证据 ${top.evidenceLabel || 'C'}）· ${top.recommendation}`,
        text_en: `[${cat.name_en || cat.name}] ${top.name_en || top.name} calibrated risk ${top.calibratedRisk ?? top.risk}% (evidence ${top.evidenceLabel || 'C'}) · ${top.recommendation_en || top.recommendation}`,
      });
    }
  });
  return [...base, ...extra].slice(0, 14);
}

function metricSource(fusionSources, metric) {
  return fusionSources.find((s) => s.metrics.includes(metric)) || fusionSources[0];
}

function buildBundle(spec) {
  const di = spec.deviceIntegration;
  const profile = {
    ...spec.profile,
    bmi: bmi(spec.profile.height, spec.profile.weight),
    device: di.primaryDevice,
    device_en: di.primaryDevice_en,
    patientId: spec.id,
    scenario: spec.scenario,
    scenario_en: spec.scenario_en,
  };

  const stats = {
    healthScore: spec.stats.healthScore,
    healthGrade: grade(spec.stats.healthScore),
    heartRate: spec.stats.heartRate,
    restingHR: spec.stats.restingHR,
    spo2: spec.stats.spo2,
    hrv: spec.stats.hrv,
    steps: spec.stats.steps,
    stepsTarget: 8000,
    sleepHours: spec.stats.sleepHours,
    activeCalories: Math.round(spec.stats.steps * 0.06),
    activeCaloriesTarget: 500,
    standHours: spec.stats.standHours || 9,
    exerciseMinutes: spec.stats.exerciseMinutes || 32,
    stressLevel: spec.stats.stressLevel || '低',
    recoveryScore: Math.min(95, Math.round(spec.stats.hrv + 25)),
    dataQuality: di.fusedQuality,
    singleDeviceQuality: di.singleQuality,
    fusionAccuracy: di.fusionAccuracy,
    singleDeviceAccuracy: di.singleDeviceAccuracy,
    accuracyGain: di.accuracyGain,
    fusionLabel: di.fusionLabel,
    fusionLabel_en: di.fusionLabel_en,
  };

  const hrSrc = metricSource(di.fusionSources, '心率');
  const spo2Src = metricSource(di.fusionSources, '血氧');
  const hrvSrc = metricSource(di.fusionSources, 'HRV');
  const sleepSrc = metricSource(di.fusionSources, '睡眠');
  const scaleSrc = metricSource(di.fusionSources, '体重') || metricSource(di.fusionSources, 'BMI');
  const bpSrc = metricSource(di.fusionSources, '血压') || hrSrc;

  const categories = scaleCategories(
    getExtendedCategories(),
    spec.screening.multiplier,
    spec.screening.boosts || {},
  );

  const screening = {
    generatedAt: new Date().toISOString(),
    overallRisk: spec.screening.overallRisk,
    overallScore: spec.screening.overallScore,
    summary: spec.screening.summary,
    summary_en: spec.screening.summary_en,
    dataCoverage: {
      days: 90,
      samples: 120000 + spec.profile.age * 100,
      devices: di.deviceCount || di.fusionSources.length,
      quality: stats.dataQuality,
      singleDeviceQuality: stats.singleDeviceQuality,
      accuracyGain: stats.accuracyGain,
      fusionMode: di.fusionMode,
    },
    categories,
    biomarkers: [
      { name: '静息心率', name_en: 'Resting heart rate', value: stats.restingHR, unit: 'bpm', ref: '60-80', status: stats.restingHR > 80 ? 'borderline' : 'normal', source: hrSrc.device, source_en: hrSrc.device_en },
      { name: '血氧饱和度', name_en: 'Blood oxygen saturation', value: stats.spo2, unit: '%', ref: '95-100', status: stats.spo2 < 95 ? 'low' : 'normal', source: spo2Src.device, source_en: spo2Src.device_en },
      { name: 'HRV (RMSSD)', name_en: 'HRV (RMSSD)', value: stats.hrv, unit: 'ms', ref: '20-70', status: stats.hrv < 30 ? 'low' : 'normal', source: hrvSrc.device, source_en: hrvSrc.device_en },
      { name: '收缩压/舒张压', name_en: 'Systolic/Diastolic pressure', value: `${spec.bp.systolic}/${spec.bp.diastolic}`, unit: 'mmHg', ref: '90-120/60-80', status: spec.bp.systolic > 130 ? 'high' : spec.bp.systolic > 120 ? 'borderline' : 'normal', source: bpSrc.device, source_en: bpSrc.device_en },
      { name: '空腹血糖', name_en: 'Fasting glucose', value: spec.glucose, unit: 'mmol/L', ref: '3.9-6.1', status: spec.glucose > 6.1 ? 'high' : spec.glucose > 5.6 ? 'borderline' : 'normal', source: '体检记录', source_en: 'Checkup record' },
      { name: 'BMI', name_en: 'BMI', value: profile.bmi, unit: '', ref: '18.5-24', status: profile.bmi > 28 ? 'high' : profile.bmi > 24 ? 'borderline' : 'normal', source: scaleSrc.device, source_en: scaleSrc.device_en },
      { name: '30天活动量', name_en: '30-day activity', value: stats.steps, unit: '步/日', ref: '≥8000', status: stats.steps < 5000 ? 'low' : 'normal', source: di.fusionLabel, source_en: di.fusionLabel_en },
      { name: '平均睡眠', name_en: 'Average sleep', value: stats.sleepHours, unit: '小时', ref: '7-9', status: stats.sleepHours < 6.5 ? 'low' : 'normal', source: sleepSrc.device, source_en: sleepSrc.device_en },
    ],
    trendData: getDemoTrendData().map((row) => ({
      ...row,
      chronic: Math.round(row.chronic * spec.screening.multiplier),
      cardio: Math.round(row.cardio * spec.screening.multiplier),
      respiratory: Math.round(row.respiratory * spec.screening.multiplier),
    })),
    aiInsights: appendCategoryScreeningInsights(spec.screening.insights || [], categories),
    recommendedExams: getRecommendedExams(),
    recommendedExams_en: getRecommendedExamsEn(),
  };

  const vitals = {
    heartRate: { value: stats.heartRate, resting: stats.restingHR, max: stats.restingHR + 85, unit: 'bpm', trend: stats.restingHR > 78 ? 'elevated' : 'stable', history: Array.from({ length: 8 }, (_, i) => stats.heartRate - 4 + i) },
    bloodOxygen: { value: stats.spo2, unit: '%', trend: stats.spo2 < 95 ? 'low' : 'stable', history: Array.from({ length: 8 }, () => stats.spo2 - 1 + Math.round(Math.random() * 2)) },
    bloodPressure: { systolic: spec.bp.systolic, diastolic: spec.bp.diastolic, unit: 'mmHg', trend: spec.bp.systolic > 130 ? 'high' : 'normal' },
    temperature: { value: 36.5, unit: '°C', trend: 'normal' },
    glucose: { value: spec.glucose, unit: 'mmol/L', trend: spec.glucose > 6.1 ? 'high' : 'normal' },
    hrv: { value: stats.hrv, baseline: stats.hrv + 5, unit: 'ms', trend: stats.hrv < 35 ? 'low' : 'stable', history: Array.from({ length: 8 }, (_, i) => stats.hrv - 3 + i) },
    respiratory: { value: spec.respRate || 16, unit: '次/分', trend: 'normal' },
    steps: { value: stats.steps, target: 8000, unit: '步' },
    calories: { value: stats.activeCalories, target: 500, unit: 'kcal' },
    standHours: { value: stats.standHours, target: 12, unit: '小时' },
    exerciseMinutes: { value: stats.exerciseMinutes, target: 30, unit: '分钟' },
  };

  return {
    id: spec.id,
    stats,
    profile,
    standards: STANDARDS,
    dashboard: {
      stats,
      vitalsTrend: todayVitalsTrend(),
      weekTrend: weekTrend(),
      healthScoreTrend: monthHealthScore(),
      heartRateZones: [
        { zone: '静息', range: '< 100', percent: stats.restingHR < 70 ? 82 : 68, color: '#4CAF50' },
        { zone: '脂肪燃烧', range: '100-120', percent: 12, color: '#2196F3' },
        { zone: '有氧', range: '120-140', percent: 7, color: '#FF9800' },
        { zone: '无氧', range: '140-160', percent: 2, color: '#F44336' },
        { zone: '极限', range: '> 160', percent: 1, color: '#9C27B0' },
      ],
      organScores: buildOrganScores(stats),
      aiInsights: spec.insights,
      recentAlerts: spec.alerts.slice(0, 2),
    },
    vitals,
    anomalies: spec.anomalies,
    predictions: scalePredictions(getDemoPredictions(), spec.predictionFactor, spec.predictionCount || 7),
    alerts: spec.alerts,
    sleep: {
      overview: {
        totalSleep: stats.sleepHours,
        deepSleep: +(stats.sleepHours * 0.22).toFixed(1),
        remSleep: +(stats.sleepHours * 0.24).toFixed(1),
        lightSleep: +(stats.sleepHours * 0.54).toFixed(1),
        awake: 0.3,
        sleepScore: Math.round(70 + stats.sleepHours * 2),
        efficiency: stats.sleepHours >= 7 ? 88 : 76,
      },
      weekSleep: weekTrend().map((d) => ({ day: d.day, total: d.sleep, deep: +(d.sleep * 0.22).toFixed(1), score: d.score })),
      aiInsights: [`平均睡眠 ${stats.sleepHours}h`, stats.sleepHours < 6.5 ? '睡眠不足，建议提前入睡' : '睡眠时长在推荐范围内'],
    },
    recovery: {
      score: Math.min(92, Math.round(stats.hrv + 22)),
      stress: { level: stats.stressLevel, value: stats.stressLevel === '高' ? 58 : stats.stressLevel === '中' ? 38 : 24, history: [30, 32, 28, 35, 26, 28, 25] },
      readiness: { score: Math.round(stats.healthScore * 0.95), recommendation: stats.healthScore >= 75 ? '适合中等强度训练' : '建议以恢复性活动为主', factors: spec.readinessFactors },
    },
    digitalTwin: {
      patient: profile.name,
      age: profile.age,
      organs: buildOrganScores(stats).map((o) => ({ name: o.name, status: o.status === 'excellent' ? 'normal' : o.status, score: o.score, metrics: {} })),
      overallScore: stats.healthScore,
    },
    fusionSources: di.fusionSources.map((s) => ({
      device: s.device,
      device_en: s.device_en,
      metrics: s.metrics,
      metrics_en: s.metrics_en,
      weight: s.weight,
      quality: s.quality,
      singleDeviceAccuracy: Math.round(s.singleDeviceAccuracy * 100),
    })),
    healthGoals: [
      { id: 1, title: '每日步数', type: 'steps', current: stats.steps, target: 8000, unit: '步', progress: Math.min(100, Math.round(stats.steps / 80)), points: 50 },
      { id: 2, title: '睡眠时长', type: 'sleep', current: stats.sleepHours, target: 8, unit: '小时', progress: Math.min(100, Math.round(stats.sleepHours / 0.08)), points: 30 },
      { id: 3, title: '静息心率', type: 'heartRate', current: stats.restingHR, target: 65, unit: 'bpm', progress: stats.restingHR <= 65 ? 100 : 70, points: 40 },
    ],
    diseaseScreening: screening,
    devices: di.devices,
    deviceIntegration: di,
    hospitals: getDemoFacilities(),
    examPackages: [
      { id: 1, name: '肿瘤早筛专项套餐', category: 'tumor', price: 2680, duration: '半天', items: ['低剂量胸部 CT', '肿瘤标志物'], suitable: '40岁以上', includesWearableReport: true },
      { id: 3, name: '慢病筛查标准套餐', category: 'chronic', price: 1280, duration: '2小时', items: ['动态血压', '血糖+HbA1c', '血脂'], suitable: '血压/血糖异常者', includesWearableReport: true },
    ],
    appointments: [],
    aiReport: {
      generatedAt: new Date().toISOString(),
      summary: spec.reportSummary,
      sections: [{ title: '综合评估', grade: grade(stats.healthScore), content: screening.summary, metrics: {} }],
      recommendations: spec.recommendations,
    },
    cohortMeta: spec.cohortMeta,
  };
}

function touchBundleCache(id, bundle) {
  if (BUNDLES.has(id)) BUNDLES.delete(id);
  BUNDLES.set(id, bundle);
  if (BUNDLES.size > MAX_BUNDLE_CACHE) {
    const oldest = BUNDLES.keys().next().value;
    BUNDLES.delete(oldest);
  }
}

function ensureBundle(patientId) {
  const id = resolveCohortDemoId(patientId);
  if (!BUNDLES.has(id)) {
    const spec = buildSpecForId(id);
    if (spec) touchBundleCache(id, buildBundle(spec));
  }
  if (!APPOINTMENTS.has(id)) APPOINTMENTS.set(id, []);
  return BUNDLES.get(id) || null;
}

function listDemoPatients(opts) {
  return searchDemoPatients(opts);
}

function resolveDemoPatientId(req) {
  const header = req?.headers?.['x-medwear-demo-patient'];
  return resolveCohortDemoId(header);
}

function getDemoPatientData(patientId) {
  const id = resolveCohortDemoId(patientId);
  const base = ensureBundle(id) || ensureBundle(DEFAULT_ID);
  return {
    ...base,
    appointments: APPOINTMENTS.get(id) || [],
  };
}

function addDemoAppointment(patientId, appt) {
  const id = resolveCohortDemoId(patientId);
  ensureBundle(id);
  const list = APPOINTMENTS.get(id) || [];
  list.unshift(appt);
  APPOINTMENTS.set(id, list);
}

function getLiveVitalsFor(data) {
  const src = data.vitals;
  const jitter = () => Math.floor(Math.random() * 6) - 3;
  return {
    heartRate: { ...src.heartRate, value: src.heartRate.value + jitter() },
    bloodOxygen: { ...src.bloodOxygen, value: Math.max(90, src.bloodOxygen.value + jitter()) },
    hrv: { ...src.hrv, value: Math.max(20, src.hrv.value + jitter()) },
    temperature: { ...src.temperature },
    respiratory: { ...src.respiratory },
    bloodPressure: { ...src.bloodPressure },
    glucose: { ...src.glucose },
    steps: { ...src.steps },
    calories: { ...src.calories },
    standHours: { ...src.standHours },
    exerciseMinutes: { ...src.exerciseMinutes },
  };
}

function buildDoctorReportFor(data) {
  const scr = data.diseaseScreening;
  const profile = data.profile;
  return {
    reportId: `MR-${data.id}-${Date.now().toString(36).toUpperCase()}`,
    generatedAt: new Date().toISOString(),
    reportType: '可穿戴融合临床筛查报告',
    reportType_en: 'Wearable-Integrated Clinical Screening Report',
    patient: { ...profile, id: data.id, phone: '138****' + data.id.slice(-4) },
    physicianSummary: scr.summary,
    physicianSummary_en: scr.summary_en,
    overallRisk: scr.overallRisk,
    overallScore: scr.overallScore,
    vitalsSnapshot: scr.biomarkers.slice(0, 6).map((b) => ({
      label: b.name, label_en: b.name_en, value: b.value, unit: b.unit, ref: b.ref, flag: b.status === 'normal' ? 'normal' : 'warning',
    })),
    weekTrend: data.dashboard.weekTrend,
    screeningHighlights: scr.categories.flatMap((c) =>
      c.items.filter((i) => i.level !== 'low').map((i) => ({
        category: c.name, category_en: c.name_en, name: i.name, name_en: i.name_en,
        risk: i.risk, level: i.level, recommendation: i.recommendation, recommendation_en: i.recommendation_en,
      })),
    ),
    screeningSummary: scr.categories.map((c) => ({
      name: c.name, name_en: c.name_en, riskLevel: c.riskLevel, score: c.score,
      topItems: c.items.slice(0, 2).map((i) => `${i.name} ${i.risk}%`),
    })),
    biomarkers: scr.biomarkers,
    anomalies: data.anomalies,
    alerts: data.alerts.slice(0, 3),
    dataSources: data.fusionSources,
    recommendedExams: scr.recommendedExams,
    recommendedExams_en: scr.recommendedExams_en,
    clinicalNotes: ['本报告基于队列成员可穿戴数据生成', '风险分层不能替代临床诊断'],
    clinicalNotes_en: ['Cohort member wearable-based report', 'Risk stratification is not a clinical diagnosis'],
    qrCode: `MEDWEAR-${data.id}`,
    dataMode: 'demo',
  };
}

module.exports = {
  DEFAULT_ID,
  listDemoPatients,
  resolveDemoPatientId,
  getDemoPatientData,
  getDemoPatientSummary,
  addDemoAppointment,
  getLiveVitalsFor,
  buildDoctorReportFor,
  searchDemoPatients,
};
