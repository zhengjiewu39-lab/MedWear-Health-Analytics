/**
 * Independent clinical adjudication for benchmark gold labels.
 * Uses guideline-style criteria that differ from MedWear-AnalyticsCore-v1
 * (stricter SpO2, different activity cutoffs, alternate risk stratification).
 * NOT used by the product pipeline — only for benchmark label generation.
 */

const EXPERT_THRESHOLDS = {
  heartRateMax: 95,
  heartRateMin: 52,
  spo2Min: 94,
  stepsLow: 3500,
  stepsVeryLow: 2500,
};

function avg(arr) {
  if (!arr?.length) return null;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stdDev(arr) {
  if (!arr?.length) return 0;
  const m = avg(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}

function sleepHours(sm = {}) {
  return (sm.deep + sm.rem + sm.light) / 60;
}

/** Reference score (0–100) — simplified wearable composite, distinct from analyticsCore weights. */
function referenceHealthScore(day) {
  let score = 0;
  let w = 0;
  if (day.steps > 0) {
    score += Math.min(day.steps / 8000, 1) * 25;
    w += 25;
  }
  const sh = sleepHours(day.sleepMinutes);
  if (sh > 0) {
    score += (sh >= 7 ? 1 : sh >= 5.5 ? 0.65 : 0.35) * 25;
    w += 25;
  }
  const rhr = day.restingHeartRate || avg(day.heartRate);
  if (rhr) {
    score += (rhr >= 55 && rhr <= 72 ? 1 : rhr < 55 ? 0.75 : 0.45) * 20;
    w += 20;
  }
  const spo2 = avg(day.spo2);
  if (spo2) {
    score += (spo2 >= 96 ? 1 : spo2 >= 92 ? 0.55 : 0.25) * 20;
    w += 20;
  }
  const hrv = avg(day.hrv);
  if (hrv) {
    score += Math.min(hrv / 55, 1) * 10;
    w += 10;
  }
  return w > 0 ? Math.round((score / w) * 100) : null;
}

function referenceRiskLevel(score) {
  if (score == null) return 'moderate';
  if (score >= 78) return 'low';
  if (score >= 58) return 'moderate';
  return 'high';
}

/**
 * Clinician-style alerts with contextual false-positive suppression
 * (exercise tachycardia, single SpO₂ artifact, planned rest day, athlete bradycardia).
 */
function expertAlerts(day, t = EXPERT_THRESHOLDS) {
  const hr = avg(day.heartRate);
  const rhr = day.restingHeartRate || hr;
  const spo2Readings = day.spo2 || [];
  const spo2 = avg(spo2Readings);
  const sh = sleepHours(day.sleepMinutes);
  const hrv = avg(day.hrv);
  const lowSpo2Count = spo2Readings.filter((s) => s < t.spo2Min).length;

  const alerts = [];
  if (hr && hr > t.heartRateMax) alerts.push('心率偏高');
  if (hr && hr < t.heartRateMin) alerts.push('心率偏低');
  if (spo2 && spo2 < t.spo2Min) alerts.push('血氧偏低');
  if (day.steps > 0 && day.steps < t.stepsLow) alerts.push('活动量不足');

  return alerts.filter((type) => {
    if (type === '心率偏高' && day.steps >= 6500 && rhr <= 78) return false;
    if (type === '血氧偏低' && lowSpo2Count <= 1 && spo2 >= 94.5) return false;
    if (type === '活动量不足' && day.steps >= 2800 && sh >= 7) return false;
    if (type === '心率偏低' && rhr >= 50 && hrv > 48 && day.steps >= 6000) return false;
    return true;
  });
}

function expertAnomaly(daysMap, targetDay) {
  const keys = Object.keys(daysMap || {}).sort();
  const window = keys.slice(-7);
  const anomalies = [];

  const allHr = window.flatMap((k) => daysMap[k].heartRate || []);
  if (allHr.length >= 8) {
    const m = avg(allHr);
    const sd = stdDev(allHr);
    window.forEach((k) => {
      const spikes = (daysMap[k].heartRate || []).filter((h) => h > m + 1.8 * sd);
      if (spikes.length >= 2) anomalies.push('hr_variability');
    });
  }

  window.forEach((k) => {
    const low = (daysMap[k].spo2 || []).filter((s) => s < 94);
    if (low.length >= 2) anomalies.push('spo2_events');
    const sh = sleepHours(daysMap[k].sleepMinutes);
    if (sh > 0 && sh < 5.5) anomalies.push('sleep_deprivation');
  });

  const target = daysMap[targetDay];
  if (target && target.steps > 0 && target.steps < EXPERT_THRESHOLDS.stepsVeryLow) {
    anomalies.push('sedentary_target');
  }

  return anomalies.length > 0;
}

/**
 * Gold-standard labels for a multi-day wearable case (independent adjudication).
 */
function adjudicateCase(caseData) {
  const days = caseData.days || {};
  const targetDay = caseData.targetDay || Object.keys(days).sort().pop();
  const day = days[targetDay] || {};
  const refScore = referenceHealthScore(day);
  const riskLevel = referenceRiskLevel(refScore);
  const alerts = expertAlerts(day);
  const anomaly = expertAnomaly(days, targetDay);

  const bandMargin = 8;
  const healthScoreMin = refScore == null ? 0 : Math.max(0, refScore - bandMargin);
  const healthScoreMax = refScore == null ? 100 : Math.min(100, refScore + bandMargin);

  return {
    alerts,
    anomaly,
    riskLevel,
    healthScoreMin,
    healthScoreMax,
    referenceScore: refScore,
    adjudication: 'clinical-gold-standard-v1',
  };
}

module.exports = {
  EXPERT_THRESHOLDS,
  referenceHealthScore,
  adjudicateCase,
};
