/**
 * Pure analytics functions for evaluation & research reproducibility.
 * Used by benchmarks, unit tests, and /api/research/* endpoints.
 */

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

function computeDayScore(dayData) {
  const d = normalizeDay(dayData);
  let score = 0;
  let weight = 0;
  if (d.steps > 0) { score += Math.min(d.steps / 10000, 1) * 30; weight += 30; }
  const sleepH = (d.sleepMinutes.deep + d.sleepMinutes.rem + d.sleepMinutes.light) / 60;
  if (sleepH > 0) { score += Math.min(sleepH / 8, 1) * 25; weight += 25; }
  const rhr = d.restingHeartRate || avg(d.heartRate);
  if (rhr) { score += (rhr >= 50 && rhr <= 75 ? 1 : rhr < 50 ? 0.7 : 0.5) * 20; weight += 20; }
  const spo2 = avg(d.spo2);
  if (spo2) { score += (spo2 >= 95 ? 1 : spo2 >= 90 ? 0.6 : 0.3) * 15; weight += 15; }
  const hrv = avg(d.hrv);
  if (hrv) { score += Math.min(hrv / 60, 1) * 10; weight += 10; }
  return weight > 0 ? Math.round((score / weight) * 100) : null;
}

function classifyRiskFromScore(score) {
  if (score == null) return 'unknown';
  if (score >= 80) return 'low';
  if (score >= 60) return 'moderate';
  return 'high';
}

function evaluateDayAlerts(dayData, thresholds = {}, patient = 'Bench') {
  const d = normalizeDay(dayData);
  const alerts = [];
  const hrMax = thresholds.heartRateMax ?? 100;
  const hrMin = thresholds.heartRateMin ?? 50;
  const spo2Min = thresholds.spo2Min ?? 93;

  const hrAvg = avg(d.heartRate);
  if (hrAvg && hrAvg > hrMax) {
    alerts.push({ type: '心率偏高', severity: 'high' });
  }
  if (hrAvg && hrAvg < hrMin) {
    alerts.push({ type: '心率偏低', severity: 'medium' });
  }
  const spo2 = avg(d.spo2);
  if (spo2 && spo2 < spo2Min) {
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

function detectAnomaliesFromStore(store) {
  const days = Object.keys(store.daily).sort();
  const window = days.slice(-14);
  const allHR = window.flatMap(d => store.daily[d].heartRate);
  const anomalies = [];
  if (allHR.length < 10) return anomalies;

  const mean = avg(allHR);
  const sd = stdDev(allHR);

  window.forEach(day => {
    const hrs = store.daily[day].heartRate;
    const spikes = hrs.filter(h => h > mean + 2 * sd);
    if (spikes.length >= 3) {
      anomalies.push({ type: '心率异常波动', day });
    }
  });

  window.forEach(day => {
    const low = store.daily[day].spo2.filter(s => s < 93);
    if (low.length >= 2) {
      anomalies.push({ type: '血氧偏低事件', day });
    }
  });

  return anomalies;
}

function evaluateCase(caseData, thresholds) {
  const store = buildStoreFromDays(caseData.days, caseData.targetDay);
  const target = caseData.targetDay || Object.keys(caseData.days).sort().pop();
  const dayData = store.daily[target];
  const alerts = evaluateDayAlerts(dayData, thresholds);
  const anomalies = detectAnomaliesFromStore(store);
  const score = computeDayScore(dayData);
  const riskLevel = classifyRiskFromScore(score);

  return {
    id: caseData.id,
    alerts: alerts.map(a => a.type),
    anomalyDetected: anomalies.length > 0,
    anomalyTypes: anomalies.map(a => a.type),
    healthScore: score,
    riskLevel,
  };
}

module.exports = {
  avg,
  stdDev,
  normalizeDay,
  computeDayScore,
  classifyRiskFromScore,
  evaluateDayAlerts,
  buildStoreFromDays,
  detectAnomaliesFromStore,
  evaluateCase,
};
