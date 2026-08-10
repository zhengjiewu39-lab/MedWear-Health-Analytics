const { computeBHIWithTrend, computeBehavioralHealthIndex, SCORE_FIELD } = require('./behavioralHealthIndex');
const { detectRobustAnomalies } = require('./robustAnomaly');
const { classifyBHIWatchTier } = require('../config/bhiWatchTier');

function avg(arr) {
  if (!arr?.length) return null;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stdDev(arr) {
  if (!arr?.length) return 0;
  const m = avg(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}

function emptySleep() {
  return { deep: 0, rem: 0, light: 0, awake: 0, inBed: 0 };
}

function normalizeDay(raw = {}) {
  return {
    steps: raw.steps || 0,
    activeEnergy: raw.activeEnergy || 0,
    heartRate: raw.heartRate || [],
    restingHeartRate: raw.restingHeartRate || null,
    spo2: raw.spo2 || [],
    hrv: raw.hrv || [],
    respiratoryRate: raw.respiratoryRate || [],
    sleepMinutes: { ...emptySleep(), ...(raw.sleepMinutes || {}) },
    exerciseMinutes: raw.exerciseMinutes || 0,
  };
}

function computeDayScore(dayData, opts = {}) {
  const d = normalizeDay(dayData);
  const prior = (opts.priorDays || []).map(normalizeDay);
  const bhi = computeBHIWithTrend(d, prior, { age: opts.age, sex: opts.sex });
  return bhi.score;
}

function computeDayScoreDetail(dayData, opts = {}) {
  const d = normalizeDay(dayData);
  const prior = (opts.priorDays || []).map(normalizeDay);
  return computeBHIWithTrend(d, prior, { age: opts.age, sex: opts.sex });
}

/** BHI watch tier — NOT calibrated disease risk. Prefer classifyBHIWatchTier. */
function classifyRiskFromScore(score) {
  return classifyBHIWatchTier(score);
}

const classifyBHIWatchTierExport = classifyBHIWatchTier;

function evaluateDayAlerts(dayData, thresholds = {}, patient = 'Bench') {
  const d = normalizeDay(dayData);
  const alerts = [];
  const hrMax = thresholds.heartRateMax ?? 100;
  const hrMin = thresholds.heartRateMin ?? 50;
  const spo2Min = thresholds.spo2Min ?? 93;

  const hrReadings = d.heartRate || [];
  const hrAvg = avg(hrReadings);
  const hrPeak = hrReadings.length ? Math.max(...hrReadings) : null;
  const hrNadir = hrReadings.length ? Math.min(...hrReadings) : null;

  if ((hrAvg && hrAvg > hrMax) || (hrPeak != null && hrPeak > hrMax)) {
    alerts.push({ type: '心率偏高', severity: 'high' });
  }
  if ((hrAvg && hrAvg < hrMin) || (hrNadir != null && hrNadir < hrMin)) {
    alerts.push({ type: '心率偏低', severity: 'medium' });
  }
  if ((d.spo2 || []).some((s) => s < spo2Min)) {
    alerts.push({ type: '血氧偏低', severity: 'high' });
  }
  if (d.steps > 0 && d.steps < 3000) {
    alerts.push({ type: '活动量不足', severity: 'low' });
  }
  return alerts;
}

function buildStoreFromDays(daysMap, targetDay) {
  const daily = {};
  Object.entries(daysMap || {}).forEach(([k, v]) => { daily[k] = normalizeDay(v); });
  const sorted = Object.keys(daily).sort();
  const target = targetDay || sorted[sorted.length - 1];
  return {
    meta: { userLabel: 'Bench', sourceList: [{ name: 'Apple Watch Series 9' }] },
    daily,
    recent: { heartRate: [], spo2: [], hrv: [], steps: [] },
    _targetDay: target,
  };
}

function detectAnomaliesFromStore(store, opts) {
  return detectRobustAnomalies(store, opts).anomalies;
}

function evaluateCase(caseData, thresholds) {
  const store = buildStoreFromDays(caseData.days, caseData.targetDay);
  const target = caseData.targetDay || Object.keys(caseData.days).sort().pop();
  const dayKeys = Object.keys(caseData.days || {}).sort();
  const targetIdx = dayKeys.indexOf(target);
  const priorDays = targetIdx > 0
    ? dayKeys.slice(Math.max(0, targetIdx - 7), targetIdx).map((k) => caseData.days[k])
    : [];
  const dayData = store.daily[target];
  const alerts = evaluateDayAlerts(dayData, thresholds);
  const anomalies = detectAnomaliesFromStore(store);
  const score = computeDayScore(dayData, { priorDays });
  const bhiWatchTier = classifyBHIWatchTier(score);

  return {
    id: caseData.id,
    alerts: alerts.map((a) => a.type),
    anomalyDetected: anomalies.length > 0,
    anomalyTypes: anomalies.map((a) => a.type),
    healthScore: score,
    scoreKind: SCORE_FIELD.kind,
    scoreLabel: SCORE_FIELD.label_en,
    bhiWatchTier,
    riskLevel: bhiWatchTier,
  };
}

module.exports = {
  avg,
  stdDev,
  normalizeDay,
  computeDayScore,
  computeDayScoreDetail,
  computeBehavioralHealthIndex,
  classifyBHIWatchTier: classifyBHIWatchTierExport,
  classifyRiskFromScore,
  evaluateDayAlerts,
  buildStoreFromDays,
  detectAnomaliesFromStore,
  evaluateCase,
};
