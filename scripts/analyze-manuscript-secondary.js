#!/usr/bin/env node
/**
 * Manuscript secondary analysis — Bland–Altman, tolerance sensitivity, per-signal agreement, MAD path audit.
 * Reads benchmarks/wearable-analytics-dataset.json; uses MedWear-AnalyticsCore-v1 + reference labels.
 */
const fs = require('fs');
const path = require('path');
const { evaluateCase, buildStoreFromDays } = require('../server/services/analyticsCore');
const { referenceHealthScore } = require('../server/services/clinicalGoldStandard');
const { detectRobustAnomalies } = require('../server/services/robustAnomaly');
const { loadRuntimeSettings } = require('../server/config/runtimeSettings');

const DATASET = path.join(__dirname, '../benchmarks/wearable-analytics-dataset.json');
const OUT = path.join(__dirname, '../benchmarks/results/manuscript-secondary.json');

const ALERT_TYPES = ['心率偏低', '心率偏高', '血氧偏低', '活动量不足'];

function wilsonCI(successes, n, z = 1.96) {
  if (!n) return { lower: 0, upper: 0, point: 0 };
  const p = successes / n;
  const denom = 1 + (z ** 2) / n;
  const centre = p + (z ** 2) / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p) + (z ** 2) / (4 * n)) / n);
  return {
    point: +p.toFixed(4),
    lower: +Math.max(0, (centre - margin) / denom).toFixed(4),
    upper: +Math.min(1, (centre + margin) / denom).toFixed(4),
  };
}

function countHrBaselineReadings(store, activityThreshold = 6500, windowDays = 14) {
  const days = Object.keys(store.daily || {}).sort().slice(-windowDays);
  let baselineHr = [];
  days.forEach((day) => {
    const d = store.daily[day];
    if ((d.steps || 0) < activityThreshold) baselineHr = baselineHr.concat(d.heartRate || []);
  });
  return baselineHr.length;
}

function pearson(xs, ys) {
  const n = xs.length;
  if (n < 2) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0; let dx = 0; let dy = 0;
  for (let i = 0; i < n; i += 1) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  const den = Math.sqrt(dx * dy);
  return den ? +(num / den).toFixed(3) : null;
}

function run() {
  const dataset = JSON.parse(fs.readFileSync(DATASET, 'utf8'));
  const thresholds = { ...loadRuntimeSettings().alertThresholds, ...(dataset.thresholds || {}) };
  const n = dataset.cases.length;

  const pairedScores = [];
  const tolerances = [5, 8, 10, 12];
  const toleranceRates = Object.fromEntries(tolerances.map((t) => [t, 0]));

  const signalStats = Object.fromEntries(ALERT_TYPES.map((t) => [t, { tp: 0, fp: 0, fn: 0 }]));

  let madRefPosMwNeg = 0;
  let madGateHrBaseline = 0;
  let madBothNeg = 0;
  let madBothPos = 0;
  let madMwPosRefNeg = 0;

  dataset.cases.forEach((c) => {
    const pred = evaluateCase(c, thresholds);
    const refScore = c.expected.referenceScore ?? referenceHealthScore(c.days[c.targetDay]);
    const mwScore = pred.healthScore;

    if (refScore != null && mwScore != null) {
      pairedScores.push({ ref: refScore, mw: mwScore, diff: mwScore - refScore, mean: (refScore + mwScore) / 2 });
      tolerances.forEach((t) => {
        if (Math.abs(mwScore - refScore) <= t) toleranceRates[t] += 1;
      });
    }

    ALERT_TYPES.forEach((type) => {
      const inRef = (c.expected.alerts || []).includes(type);
      const inMw = (pred.alerts || []).includes(type);
      if (inRef && inMw) signalStats[type].tp += 1;
      else if (!inRef && inMw) signalStats[type].fp += 1;
      else if (inRef && !inMw) signalStats[type].fn += 1;
    });

    const refAnom = Boolean(c.expected.anomaly);
    const mwAnom = Boolean(pred.anomalyDetected);
    if (refAnom && mwAnom) madBothPos += 1;
    else if (!refAnom && !mwAnom) madBothNeg += 1;
    else if (!refAnom && mwAnom) madMwPosRefNeg += 1;
    else if (refAnom && !mwAnom) {
      madRefPosMwNeg += 1;
      const store = buildStoreFromDays(c.days, c.targetDay);
      if (countHrBaselineReadings(store) < 10) madGateHrBaseline += 1;
    }
  });

  const diffs = pairedScores.map((p) => p.diff);
  const meanDiff = diffs.length ? +(diffs.reduce((a, b) => a + b, 0) / diffs.length).toFixed(2) : null;
  const absDiffs = diffs.map(Math.abs).sort((a, b) => a - b);
  const mae = absDiffs.length ? +(absDiffs.reduce((a, b) => a + b, 0) / absDiffs.length).toFixed(2) : null;
  const medianAbs = absDiffs.length ? absDiffs[Math.floor(absDiffs.length / 2)] : null;
  const q1 = absDiffs.length ? absDiffs[Math.floor(absDiffs.length * 0.25)] : null;
  const q3 = absDiffs.length ? absDiffs[Math.floor(absDiffs.length * 0.75)] : null;
  const sdDiff = diffs.length > 1
    ? Math.sqrt(diffs.reduce((s, d) => s + (d - meanDiff) ** 2, 0) / (diffs.length - 1))
    : 0;
  const loaLower = meanDiff != null ? +(meanDiff - 1.96 * sdDiff).toFixed(2) : null;
  const loaUpper = meanDiff != null ? +(meanDiff + 1.96 * sdDiff).toFixed(2) : null;

  const meanBins = [
    { label: '<40', min: 0, max: 40 },
    { label: '40-<60', min: 40, max: 60 },
    { label: '60-<80', min: 60, max: 80 },
    { label: '80-100', min: 80, max: 101 },
  ].map((bin) => {
    const subset = pairedScores.filter((p) => p.mean >= bin.min && p.mean < bin.max);
    const d = subset.map((p) => p.diff);
    const m = d.length ? d.reduce((a, b) => a + b, 0) / d.length : null;
    const sd = d.length > 1 ? Math.sqrt(d.reduce((s, x) => s + (x - m) ** 2, 0) / (d.length - 1)) : null;
    return { ...bin, n: subset.length, meanDiff: m != null ? +m.toFixed(2) : null, sdDiff: sd != null ? +sd.toFixed(2) : null };
  });

  const perSignal = {};
  ALERT_TYPES.forEach((type) => {
    const { tp, fp, fn } = signalStats[type];
    const precision = tp + fp > 0 ? tp / (tp + fp) : (tp === 0 && fp === 0 ? 1 : 0);
    const recall = tp + fn > 0 ? tp / (tp + fn) : 1;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    perSignal[type] = {
      tp, fp, fn,
      precision: +precision.toFixed(4),
      recall: +recall.toFixed(4),
      f1: +f1.toFixed(4),
    };
  });

  return {
    version: 'manuscript-secondary-v1',
    generatedAt: new Date().toISOString(),
    n,
    engine: 'MedWear-AnalyticsCore-v1',
    referenceStandard: 'independentSyntheticReference-v1',
    bhiScoreAgreement: {
      toleranceWithinPoints: Object.fromEntries(
        tolerances.map((t) => [t, +((toleranceRates[t] / n).toFixed(4))]),
      ),
      meanDiff,
      meanAbsoluteDiff: mae,
      medianAbsoluteDiff: medianAbs,
      absDiffIqr: q1 != null && q3 != null ? [q1, q3] : null,
      blandAltman: { meanDifference: meanDiff, limitsOfAgreement: [loaLower, loaUpper] },
      diffVsMeanPearsonR: pearson(pairedScores.map((p) => p.mean), diffs),
      meanDiffByPairedMeanBin: meanBins,
    },
    perSignalAgreement: perSignal,
    madCaseAudit: {
      referencePositiveMedWearNegative: madRefPosMwNeg,
      hrBaselineGateAmongRefPosMwNeg: madGateHrBaseline,
      hrBaselineGateShare: madRefPosMwNeg ? +(madGateHrBaseline / madRefPosMwNeg).toFixed(3) : null,
      bothPositive: madBothPos,
      bothNegative: madBothNeg,
      medWearPositiveReferenceNegative: madMwPosRefNeg,
      caseLevelAgreement: +(((madBothPos + madBothNeg) / n).toFixed(4)),
      wilson95: wilsonCI(madBothPos + madBothNeg, n),
    },
    disclaimer_en: 'Descriptive inter-engine agreement on synthetic cases — not clinical performance.',
  };
}

if (require.main === module) {
  const payload = run();
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));
  console.log(`Manuscript secondary analysis n=${payload.n} → ${OUT}`);
  console.log(`  BHI mean diff: ${payload.bhiScoreAgreement.meanDiff} · LoA ${payload.bhiScoreAgreement.blandAltman.limitsOfAgreement.join(' to ')}`);
  console.log(`  MAD ref+/mw−: ${payload.madCaseAudit.referencePositiveMedWearNegative} (HR gate ${payload.madCaseAudit.hrBaselineGateAmongRefPosMwNeg})`);
}

module.exports = { run };
