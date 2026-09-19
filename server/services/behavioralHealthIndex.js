/**
 * Behavioral Health Index (BHI) — NOT a calibrated disease-risk score.
 * Continuous component functions with optional age/sex adjustment and missing-data reporting.
 */

const SCORE_KIND = 'behavioral-health-index';

/** API compatibility: JSON field `healthScore` holds BHI (not disease risk). */
const SCORE_FIELD = {
  apiField: 'healthScore',
  kind: SCORE_KIND,
  label_en: 'Behavioral Health Index (BHI)',
  label_zh: '行为健康指数（BHI）',
  note_en:
    'Field name healthScore is kept for backward compatibility; values are BHI (behavioral wellness index), not a calibrated disease-risk score.',
  note_zh:
    '字段名 healthScore 为向后兼容保留；数值为 BHI（行为健康指数），非经临床校准的疾病风险评分。',
};

const WEIGHTS = { steps: 0.28, sleep: 0.24, rhr: 0.20, spo2: 0.16, hrv: 0.12 };

function avg(arr) {
  if (!arr?.length) return null;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function sleepHours(sm = {}) {
  return (sm.deep + sm.rem + sm.light) / 60;
}

function agePresent(age) {
  return age != null && Number.isFinite(age);
}

function sexPresent(sex) {
  return sex === 'M' || sex === 'F';
}

/** Sigmoid-like activity score centred ~5500 steps/day. */
function scoreSteps(steps) {
  return 1 / (1 + Math.exp(-(steps - 5500) / 1800));
}

/** Gaussian sleep adequacy peaking ~7.25 h (estimated sleep duration: deep + REM + light). */
function scoreSleep(hours) {
  return Math.exp(-((hours - 7.25) ** 2) / (2 * 1.4 ** 2));
}

/** Age/sex-adjusted RHR — smooth bell around reference. */
function scoreRhr(rhr, age, sex) {
  const ref = (sex === 'M' ? 62 : 65) + Math.max(0, age - 40) * 0.15;
  return Math.exp(-((rhr - ref) ** 2) / (2 * 12 ** 2));
}

/** Smooth SpO2 curve — steeper decline below 94%. */
function scoreSpo2(spo2) {
  return 1 / (1 + Math.exp(-(spo2 - 94) / 0.75));
}

/** Age-adjusted HRV (SDNN, ms) — transparent cap vs reference (not RMSSD). */
function sdnnReferenceMs(age) {
  return Math.max(28, 50 - Math.max(0, age - 30) * 0.45);
}

function scoreHrv(hrv, age) {
  const ref = sdnnReferenceMs(age);
  return Math.min(1, hrv / ref);
}

function rhrUnavailableReason({ age, sex, rhr }) {
  const hasAge = agePresent(age);
  const hasSex = sexPresent(sex);
  const hasRhr = rhr != null && rhr > 0;
  if (!hasRhr) return 'missing_rhr';
  if (!hasAge && !hasSex) return 'missing_age_and_sex';
  if (!hasAge) return 'missing_age';
  if (!hasSex) return 'missing_sex';
  return null;
}

function hrvUnavailableReason({ age, hrv }) {
  const hasHrv = Boolean(hrv);
  if (!hasHrv) return 'missing_sdnn';
  if (!agePresent(age)) return 'missing_age';
  return null;
}

function computeBehavioralHealthIndex(dayData, opts = {}) {
  const age = opts.age;
  const sex = opts.sex;
  const components = {};
  const missing = [];
  const unavailable = {};
  let weighted = 0;
  let totalW = 0;

  if (dayData.stepsMissing) {
    missing.push('steps');
    unavailable.steps = 'missing_steps_record';
  } else if (dayData.steps > 0) {
    components.steps = +scoreSteps(dayData.steps).toFixed(3);
    weighted += components.steps * WEIGHTS.steps;
    totalW += WEIGHTS.steps;
  } else if (dayData.stepsRecorded) {
    missing.push('steps');
    unavailable.steps = 'zero_steps_day';
    components.steps = +scoreSteps(0).toFixed(3);
    weighted += components.steps * WEIGHTS.steps;
    totalW += WEIGHTS.steps;
  } else {
    missing.push('steps');
  }

  const sh = sleepHours(dayData.sleepMinutes || {});
  if (sh > 0) {
    components.sleep = +scoreSleep(sh).toFixed(3);
    weighted += components.sleep * WEIGHTS.sleep;
    totalW += WEIGHTS.sleep;
  } else missing.push('sleep');

  const rhr = dayData.restingHeartRate;
  const rhrReason = rhrUnavailableReason({ age, sex, rhr });
  if (rhrReason) {
    missing.push('rhr');
    unavailable.rhr = rhrReason;
  } else {
    components.rhr = +scoreRhr(rhr, age, sex).toFixed(3);
    weighted += components.rhr * WEIGHTS.rhr;
    totalW += WEIGHTS.rhr;
  }

  const spo2 = avg(dayData.spo2);
  if (spo2) {
    components.spo2 = +scoreSpo2(spo2).toFixed(3);
    weighted += components.spo2 * WEIGHTS.spo2;
    totalW += WEIGHTS.spo2;
  } else missing.push('spo2');

  const hrv = avg(dayData.hrv);
  const hrvReason = hrvUnavailableReason({ age, hrv });
  if (hrvReason) {
    missing.push('hrv');
    unavailable.hrv = hrvReason;
  } else {
    components.hrv = +scoreHrv(hrv, age).toFixed(3);
    weighted += components.hrv * WEIGHTS.hrv;
    totalW += WEIGHTS.hrv;
  }

  const raw = totalW > 0 ? Math.round((weighted / totalW) * 100) : null;

  return {
    score: raw,
    kind: SCORE_KIND,
    label_en: 'Behavioral Health Index (not disease risk)',
    label_zh: '行为健康指数（非疾病风险评分）',
    weights: WEIGHTS,
    components,
    missing,
    unavailable,
    coverage: totalW > 0 ? +(totalW).toFixed(2) : 0,
    maxCoverage: Object.values(WEIGHTS).reduce((a, b) => a + b, 0),
    renormalized: missing.length > 0,
    disclaimer_en: 'BHI reflects wearable lifestyle proxies only; not validated for diagnosis.',
    disclaimer_zh: 'BHI 仅反映可穿戴行为代理信号，未经临床诊断校准。',
  };
}

/** Optional ±3 trend adjustment from prior 7-day BHI mean. */
function computeBHIWithTrend(dayData, priorDays = [], opts = {}) {
  const base = computeBehavioralHealthIndex(dayData, opts);
  if (!base.score || priorDays.length < 3) return base;

  const prior = priorDays
    .map((d) => computeBehavioralHealthIndex(d, opts).score)
    .filter((s) => s != null);
  if (prior.length < 3) return base;

  const trendDelta = Math.round(Math.max(-3, Math.min(3, (base.score - avg(prior)) * 0.12)));
  return {
    ...base,
    trendDelta,
    score: Math.max(0, Math.min(100, base.score + trendDelta)),
  };
}

/** Missing-component sensitivity: score if each missing signal were at cohort median. */
function missingDataSensitivity(dayData, opts = {}) {
  const medians = { steps: 7200, sleepH: 7.1, rhr: 66, spo2: 97.2, hrv: 45 };
  const base = computeBehavioralHealthIndex(dayData, opts);
  const filled = { ...dayData };
  if (!filled.steps) filled.steps = medians.steps;
  if (!sleepHours(filled.sleepMinutes || {})) {
    filled.sleepMinutes = { deep: 85, rem: 95, light: 200, awake: 20 };
  }
  if (!filled.restingHeartRate) filled.restingHeartRate = medians.rhr;
  if (!filled.spo2?.length) filled.spo2 = [medians.spo2];
  if (!filled.hrv?.length) filled.hrv = [medians.hrv];
  const imputed = computeBehavioralHealthIndex(filled, opts);
  return {
    observed: base.score,
    imputedAtMedian: imputed.score,
    delta: base.score != null && imputed.score != null ? imputed.score - base.score : null,
    missing: base.missing,
    unavailable: base.unavailable,
  };
}

module.exports = {
  SCORE_KIND,
  SCORE_FIELD,
  WEIGHTS,
  sleepHours,
  computeBehavioralHealthIndex,
  computeBHIWithTrend,
  missingDataSensitivity,
  scoreSteps,
  scoreRhr,
  scoreSpo2,
  scoreHrv,
  scoreSleep,
  sdnnReferenceMs,
  rhrUnavailableReason,
  hrvUnavailableReason,
};
