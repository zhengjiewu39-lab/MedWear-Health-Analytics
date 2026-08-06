/**
 * Clinically plausible random wearable physiology synthesis.
 * Correlated adult vitals + day-to-day autocorrelation; seed-based RNG for reproducibility.
 * Used by benchmark generator — NOT by the product analytics pipeline.
 */

/** Published-style adult wearable reference bands (synthetic cohort targets). */
const ADULT_REFERENCE = {
  steps: { p5: 1200, p25: 4500, median: 7200, p75: 9800, p95: 13500, unit: 'steps/day' },
  restingHeartRate: { min: 48, max: 88, mean: 62, unit: 'bpm' },
  heartRate: { min: 52, max: 118, unit: 'bpm' },
  spo2: { min: 92, max: 100, mean: 97.2, unit: '%' },
  hrv: { min: 18, max: 75, mean: 42, unit: 'ms' },
  sleepHours: { min: 4.5, max: 9.5, mean: 7.1, unit: 'h' },
  activeEnergy: { min: 120, max: 620, mean: 340, unit: 'kcal' },
};

const AGE_BANDS = [
  { key: '18-34', weight: 0.35, rhrShift: -3, hrvShift: 6, stepsShift: 400 },
  { key: '35-54', weight: 0.45, rhrShift: 0, hrvShift: 0, stepsShift: 0 },
  { key: '55-75', weight: 0.20, rhrShift: 5, hrvShift: -8, stepsShift: -900 },
];

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

function round(v, d = 0) {
  const f = 10 ** d;
  return Math.round(v * f) / f;
}

function randInt(rng, lo, hi) {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

function gaussian(rng, mean = 0, sd = 1) {
  const u = Math.max(rng(), 1e-10);
  const v = rng();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return mean + z * sd;
}

function pickWeighted(rng, items) {
  const total = items.reduce((s, x) => s + x.weight, 0);
  let r = rng() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

function avg(arr) {
  if (!arr?.length) return null;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function sleepHours(sm = {}) {
  return (sm.deep + sm.rem + sm.light) / 60;
}

/** Random adult subject baseline — fitness, age band, sex drive correlated vitals. */
function sampleSubjectProfile(rng) {
  const ageBand = pickWeighted(rng, AGE_BANDS);
  const sex = rng() < 0.52 ? 'F' : 'M';
  const fitness = clamp(gaussian(rng, 0.52, 0.18), 0.08, 0.95);

  const rhrBase = clamp(
    gaussian(rng, 58 + ageBand.rhrShift + (sex === 'M' ? 2 : 0) + (1 - fitness) * 14, 4),
    ADULT_REFERENCE.restingHeartRate.min,
    ADULT_REFERENCE.restingHeartRate.max,
  );
  const hrvBase = clamp(
    gaussian(rng, 26 + ageBand.hrvShift + fitness * 32, 6),
    ADULT_REFERENCE.hrv.min,
    ADULT_REFERENCE.hrv.max,
  );
  const stepsBase = clamp(
    gaussian(rng, ADULT_REFERENCE.steps.median + ageBand.stepsShift + (fitness - 0.5) * 4200, 1800),
    800,
    14000,
  );
  const spo2Base = clamp(gaussian(rng, 97.4 - (ageBand.key === '55-75' ? 0.4 : 0), 0.45), 94.5, 99.5);
  const sleepMeanH = clamp(gaussian(rng, 7.0 - (1 - fitness) * 0.35, 0.55), 5.2, 8.8);
  const deepPct = clamp(0.18 + fitness * 0.06 + gaussian(rng, 0, 0.02), 0.12, 0.28);
  const remPct = clamp(0.22 + gaussian(rng, 0, 0.025), 0.15, 0.30);

  return {
    ageBand: ageBand.key,
    sex,
    fitness: round(fitness, 2),
    rhrBase: round(rhrBase),
    hrvBase: round(hrvBase),
    stepsBase: round(stepsBase),
    spo2Base: round(spo2Base, 1),
    sleepMeanH: round(sleepMeanH, 1),
    deepPct: round(deepPct, 3),
    remPct: round(remPct, 3),
  };
}

function buildSleepMinutes(rng, profile, prevSleepH = null) {
  const ar = 0.55;
  let totalH = prevSleepH != null
    ? ar * prevSleepH + (1 - ar) * profile.sleepMeanH + gaussian(rng, 0, 0.35)
    : profile.sleepMeanH + gaussian(rng, 0, 0.4);
  totalH = clamp(totalH, ADULT_REFERENCE.sleepHours.min, ADULT_REFERENCE.sleepHours.max);
  const totalMin = Math.round(totalH * 60);
  const deep = clamp(Math.round(totalMin * profile.deepPct + gaussian(rng, 0, 8)), 25, 110);
  const rem = clamp(Math.round(totalMin * profile.remPct + gaussian(rng, 0, 10)), 35, 120);
  const awake = randInt(rng, 8, Math.min(55, Math.round(totalMin * 0.08)));
  const light = Math.max(90, totalMin - deep - rem);
  return { deep, rem, light, awake };
}

/** One wearable day with cross-metric clinical coupling + optional AR(1) continuity. */
function sampleClinicalDay(rng, profile, prevDay = null) {
  const ar = 0.62;

  let steps = prevDay?.steps != null
    ? ar * prevDay.steps + (1 - ar) * profile.stepsBase + gaussian(rng, 0, 900)
    : profile.stepsBase + gaussian(rng, 0, 1100);
  steps = clamp(Math.round(steps), 800, 14000);

  let rhr = prevDay?.restingHeartRate != null
    ? ar * prevDay.restingHeartRate + (1 - ar) * profile.rhrBase + gaussian(rng, 0, 3)
    : profile.rhrBase + gaussian(rng, 0, 3.5);
  rhr = clamp(Math.round(rhr), ADULT_REFERENCE.restingHeartRate.min, ADULT_REFERENCE.restingHeartRate.max);

  const activityLoad = steps / 8000;
  const hrMean = clamp(rhr + activityLoad * 14 + gaussian(rng, 0, 3.5), ADULT_REFERENCE.heartRate.min, ADULT_REFERENCE.heartRate.max);
  const hrN = randInt(rng, 3, 5);
  const heartRate = Array.from({ length: hrN }, () =>
    clamp(Math.round(hrMean + gaussian(rng, 0, 5)), ADULT_REFERENCE.heartRate.min, 132),
  );

  const avgHr = avg(heartRate);
  const spo2Mean = clamp(
    profile.spo2Base - Math.max(0, (avgHr - 88) * 0.06) - (steps > 11000 ? 0.3 : 0) + gaussian(rng, 0, 0.35),
    ADULT_REFERENCE.spo2.min,
    ADULT_REFERENCE.spo2.max,
  );
  const spo2N = randInt(rng, 2, 4);
  const spo2 = Array.from({ length: spo2N }, () =>
    clamp(round(spo2Mean + gaussian(rng, 0, 0.45), 1), 88, 100),
  );

  const hrvMean = clamp(
    profile.hrvBase - (rhr - profile.rhrBase) * 0.55 + gaussian(rng, 0, 4),
    ADULT_REFERENCE.hrv.min,
    ADULT_REFERENCE.hrv.max,
  );
  const hrv = [round(hrvMean + gaussian(rng, 0, 3)), round(hrvMean + gaussian(rng, 0, 3))];

  const prevSleepH = prevDay?.sleepMinutes ? sleepHours(prevDay.sleepMinutes) : null;
  const sleepMinutes = buildSleepMinutes(rng, profile, prevSleepH);

  const energyPerStep = 0.028 + profile.fitness * 0.014;
  let activeEnergy = Math.round(steps * energyPerStep + gaussian(rng, 40, 35));
  activeEnergy = clamp(activeEnergy, ADULT_REFERENCE.activeEnergy.min, ADULT_REFERENCE.activeEnergy.max);

  return enforceClinicalPlausibility({
    steps,
    heartRate,
    spo2,
    hrv,
    restingHeartRate: rhr,
    sleepMinutes,
    activeEnergy,
  });
}

/** Clamp impossible joint combinations after sampling. */
function enforceClinicalPlausibility(day) {
  const out = { ...day, sleepMinutes: { ...day.sleepMinutes } };
  out.restingHeartRate = clamp(out.restingHeartRate, 45, 95);
  out.heartRate = (out.heartRate || []).map((h) => clamp(h, 48, 130));
  out.spo2 = (out.spo2 || []).map((s) => clamp(round(s, 1), 88, 100));
  out.hrv = (out.hrv || []).map((h) => clamp(round(h), 12, 90));
  out.steps = clamp(out.steps, 800, 14000);
  const sh = sleepHours(out.sleepMinutes);
  if (sh < 4.5 || sh > 10) {
    const scale = (7.0 * 60) / Math.max(60, out.sleepMinutes.deep + out.sleepMinutes.rem + out.sleepMinutes.light);
    out.sleepMinutes.deep = Math.round(out.sleepMinutes.deep * scale);
    out.sleepMinutes.rem = Math.round(out.sleepMinutes.rem * scale);
    out.sleepMinutes.light = Math.max(100, Math.round(out.sleepMinutes.light * scale));
  }
  const minEnergy = Math.round(out.steps * 0.022);
  out.activeEnergy = clamp(out.activeEnergy, Math.max(80, minEnergy - 40), 680);
  return out;
}

/** Multi-day series from one random adult profile (28% benchmark mix). */
function buildClinicalRandomDays(rng, days, startDate = '2026-06-08') {
  const profile = sampleSubjectProfile(rng);
  const start = new Date(startDate);
  const daysMap = {};
  let targetKey = null;
  let prev = null;
  for (let i = 0; i < days; i++) {
    const dt = new Date(start);
    dt.setDate(start.getDate() + i);
    const key = dt.toISOString().slice(0, 10);
    if (i === days - 1) targetKey = key;
    const day = sampleClinicalDay(rng, profile, prev);
    daysMap[key] = day;
    prev = day;
  }
  return { days: daysMap, targetDay: targetKey, profile };
}

function summarizeSeries(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  return {
    n,
    mean: round(mean, 2),
    median: round(percentile(sorted, 0.5), 2),
    p5: round(percentile(sorted, 0.05), 2),
    p95: round(percentile(sorted, 0.95), 2),
  };
}

/** Cohort-level vitals summary on target days (validates clinical realism). */
function computeCohortClinicalStats(cases) {
  const steps = [];
  const rhr = [];
  const hr = [];
  const spo2 = [];
  const hrv = [];
  const sleepH = [];
  const energy = [];
  const ageBands = {};
  let withinRef = 0;

  (cases || []).forEach((c) => {
    const day = c.days?.[c.targetDay] || Object.values(c.days || {}).pop();
    if (!day) return;
    steps.push(day.steps);
    rhr.push(day.restingHeartRate);
    hr.push(avg(day.heartRate));
    spo2.push(avg(day.spo2));
    hrv.push(avg(day.hrv));
    sleepH.push(sleepHours(day.sleepMinutes));
    energy.push(day.activeEnergy);

    const inRef =
      day.steps >= ADULT_REFERENCE.steps.p5 && day.steps <= ADULT_REFERENCE.steps.p95
      && day.restingHeartRate >= ADULT_REFERENCE.restingHeartRate.min
      && day.restingHeartRate <= ADULT_REFERENCE.restingHeartRate.max
      && avg(day.spo2) >= ADULT_REFERENCE.spo2.min
      && avg(day.hrv) >= ADULT_REFERENCE.hrv.min;
    if (inRef) withinRef += 1;
  });

  return {
    module: 'clinicalPhysiology-v1',
    reference: ADULT_REFERENCE,
    targetDayVitals: {
      steps: summarizeSeries(steps),
      restingHeartRate: summarizeSeries(rhr),
      heartRate: summarizeSeries(hr),
      spo2: summarizeSeries(spo2),
      hrv: summarizeSeries(hrv),
      sleepHours: summarizeSeries(sleepH),
      activeEnergy: summarizeSeries(energy),
    },
    withinReferencePct: cases?.length ? round(withinRef / cases.length, 3) : null,
    ageBandDistribution: ageBands,
    correlations: {
      stepsEnergy: round(
        pearson(steps, energy),
        3,
      ),
      rhrHrv: round(
        pearson(rhr, hrv),
        3,
      ),
    },
  };
}

function pearson(xs, ys) {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return null;
  const mx = xs.slice(0, n).reduce((s, v) => s + v, 0) / n;
  const my = ys.slice(0, n).reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  return den > 0 ? num / den : null;
}

module.exports = {
  ADULT_REFERENCE,
  sampleSubjectProfile,
  sampleClinicalDay,
  buildClinicalRandomDays,
  enforceClinicalPlausibility,
  computeCohortClinicalStats,
};
