/**
 * Extract tabular features from wearable day/window data for ML experiments.
 */

const {
  avg,
  stdDev,
  computeDayScore,
  evaluateDayAlerts,
  detectAnomaliesFromStore,
  buildStoreFromDays,
  classifyRiskFromScore,
} = require('./analyticsCore');

const FEATURE_NAMES = [
  'steps_norm',
  'avg_hr',
  'std_hr',
  'resting_hr',
  'avg_spo2',
  'min_spo2',
  'avg_hrv',
  'sleep_hours',
  'deep_sleep_ratio',
  'active_energy_norm',
  'hr_above_threshold',
  'spo2_below_threshold',
  'low_activity',
  'window_hr_mean',
  'window_hr_std',
  'anomaly_flag',
  'health_score_norm',
];

const DEFAULT_THRESHOLDS = { heartRateMax: 100, heartRateMin: 50, spo2Min: 93 };

function sleepHours(day) {
  const s = day.sleepMinutes || {};
  return ((s.deep || 0) + (s.rem || 0) + (s.light || 0)) / 60;
}

function extractFeatures(caseData, thresholds = DEFAULT_THRESHOLDS) {
  const daysMap = caseData.days || {};
  const targetDay = caseData.targetDay || Object.keys(daysMap).sort().pop();
  const store = buildStoreFromDays(daysMap, targetDay);
  const day = store.daily[targetDay];
  if (!day) throw new Error(`Missing target day ${targetDay}`);

  const sorted = Object.keys(daysMap).sort();
  const allHR = sorted.flatMap(d => daysMap[d].heartRate || []);
  const alerts = evaluateDayAlerts(day, thresholds);
  const anomalies = detectAnomaliesFromStore(store);
  const score = computeDayScore(day) || 0;
  const spo2 = day.spo2 || [];
  const totalSleep = sleepHours(day);
  const deep = (day.sleepMinutes?.deep || 0) / 60;

  return {
    steps_norm: Math.min(day.steps / 10000, 2),
    avg_hr: avg(day.heartRate) || 0,
    std_hr: stdDev(day.heartRate || []),
    resting_hr: day.restingHeartRate || avg(day.heartRate) || 0,
    avg_spo2: avg(spo2) || 0,
    min_spo2: spo2.length ? Math.min(...spo2) : 0,
    avg_hrv: avg(day.hrv) || 0,
    sleep_hours: totalSleep,
    deep_sleep_ratio: totalSleep > 0 ? deep / totalSleep : 0,
    active_energy_norm: Math.min((day.activeEnergy || 0) / 500, 2),
    hr_above_threshold: alerts.some(a => a.type === '心率偏高') ? 1 : 0,
    spo2_below_threshold: alerts.some(a => a.type === '血氧偏低') ? 1 : 0,
    low_activity: alerts.some(a => a.type === '活动量不足') ? 1 : 0,
    window_hr_mean: avg(allHR) || 0,
    window_hr_std: stdDev(allHR),
    anomaly_flag: anomalies.length > 0 ? 1 : 0,
    health_score_norm: score / 100,
  };
}

function extractLabels(caseData) {
  const exp = caseData.expected || {};
  if (exp.riskLevel) return { label: exp.riskLevel, task: 'risk' };
  if (typeof exp.anomaly === 'boolean') return { label: exp.anomaly ? 1 : 0, task: 'anomaly' };
  const daysMap = caseData.days || {};
  const targetDay = caseData.targetDay || Object.keys(daysMap).sort().pop();
  const score = computeDayScore(daysMap[targetDay]) || 0;
  return { label: classifyRiskFromScore(score), task: 'risk' };
}

module.exports = {
  FEATURE_NAMES,
  DEFAULT_THRESHOLDS,
  extractFeatures,
  extractLabels,
};
