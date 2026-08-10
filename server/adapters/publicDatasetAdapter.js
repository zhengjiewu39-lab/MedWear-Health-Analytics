/**
 * Adapters mapping public wearable dataset windows → MedWear 17-dim feature schema.
 * Full WESAD/PPG-DaLiA require user download; this module supports bundled proxy samples
 * and CSV imports following the portable schema in extractFeatures.js.
 */

const { FEATURE_NAMES } = require('../services/extractFeatures');

/** Map a simplified physiological window to portable features (0–1 normalized where applicable). */
function windowToFeatures(window = {}) {
  const meanHr = window.meanHr ?? 70;
  const stdHr = window.stdHr ?? 5;
  const spo2 = window.spo2 ?? 97;
  const steps = window.steps ?? 5000;
  const hrv = window.hrv ?? 45;
  const sleepH = window.sleepHours ?? 7;
  const score = window.bhiProxy ?? Math.max(30, Math.min(95, 100 - (meanHr - 65) * 1.2));

  return {
    steps_norm: Math.min(steps / 10000, 2),
    avg_hr: meanHr,
    std_hr: stdHr,
    resting_hr: window.restingHr ?? meanHr - 5,
    avg_spo2: spo2,
    min_spo2: window.minSpo2 ?? spo2 - 1,
    avg_hrv: hrv,
    sleep_hours: sleepH,
    deep_sleep_ratio: window.deepSleepRatio ?? 0.22,
    active_energy_norm: Math.min((window.activeEnergy ?? steps / 20) / 500, 2),
    hr_above_threshold: meanHr > 100 ? 1 : 0,
    spo2_below_threshold: spo2 < 93 ? 1 : 0,
    low_activity: steps < 3000 ? 1 : 0,
    window_hr_mean: window.windowHrMean ?? meanHr,
    window_hr_std: window.windowHrStd ?? stdHr,
    anomaly_flag: window.anomalyFlag ?? (meanHr > 100 || spo2 < 93 ? 1 : 0),
    health_score_norm: score / 100,
  };
}

/** WESAD-inspired stress vs baseline proxy (literature HR elevation under stress tasks). */
function generateWesadStressProxySample(n = 120, seed = 42) {
  let s = seed;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  const gauss = (mu, sd) => mu + sd * Math.sqrt(-2 * Math.log(rnd() || 1e-9)) * Math.cos(2 * Math.PI * rnd());

  const windows = [];
  for (let i = 0; i < n; i++) {
    const stress = i % 2 === 1;
    const meanHr = gauss(stress ? 92 : 72, stress ? 12 : 8);
    const hrv = gauss(stress ? 32 : 48, stress ? 8 : 10);
    const steps = Math.max(500, gauss(stress ? 2800 : 6200, 1500));
    const label = stress ? 'moderate' : 'low';
    windows.push({
      id: `WESAD-proxy-${String(i + 1).padStart(3, '0')}`,
      condition: stress ? 'stress/task' : 'baseline',
      label,
      meanHr: +meanHr.toFixed(1),
      stdHr: +(stress ? 14 : 7),
      spo2: +(gauss(97, 1)).toFixed(1),
      hrv: +hrv.toFixed(1),
      steps: Math.round(steps),
      sleepHours: +(gauss(6.8, 0.8)).toFixed(2),
      bhiProxy: stress ? gauss(58, 8) : gauss(82, 6),
    });
  }
  return {
    dataset: 'WESAD-stress-proxy-sample',
    version: '1.0.0',
    n: windows.length,
    source_en:
      'Synthetic windows with HR/HRV shifts modeled on WESAD stress-vs-baseline literature — not raw WESAD subject data.',
    source_zh: '按 WESAD 压力/基线文献范围合成的 HR/HRV 窗口 — 非原始 WESAD 受试者数据。',
    featureSchema: FEATURE_NAMES,
    windows,
  };
}

function trapezoidAuc(scores, labelsBinary) {
  const n = scores.length;
  const pos = labelsBinary.filter((y) => y === 1).length;
  const neg = n - pos;
  if (!pos || !neg) return null;
  const pairs = scores.map((s, i) => ({ s, y: labelsBinary[i] })).sort((a, b) => b.s - a.s);
  let tp = 0;
  let fp = 0;
  let auc = 0;
  let prevFpr = 0;
  let prevTpr = 0;
  pairs.forEach(({ y }) => {
    if (y === 1) tp += 1;
    else fp += 1;
    const tpr = tp / pos;
    const fpr = fp / neg;
    auc += (fpr - prevFpr) * (tpr + prevTpr) / 2;
    prevFpr = fpr;
    prevTpr = tpr;
  });
  return +auc.toFixed(4);
}

function evaluateProxyDataset(dataset) {
  const rows = (dataset.windows || []).map((w) => ({
    id: w.id,
    label: w.label,
    condition: w.condition,
    stressBinary: w.condition === 'stress/task' || w.label !== 'low' ? 1 : 0,
    features: windowToFeatures(w),
  }));

  let heuristicCorrect = 0;
  let anomalyAgree = 0;
  const bhiScores = [];
  const anomalyScores = [];
  const stressLabels = [];
  rows.forEach((r) => {
    const s = r.features.health_score_norm;
    const pred = s >= 0.8 ? 'low' : s >= 0.6 ? 'moderate' : 'high';
    if (pred === r.label) heuristicCorrect++;
    const goldAnomaly = r.label !== 'low' ? 1 : 0;
    if (r.features.anomaly_flag === goldAnomaly) anomalyAgree++;
    bhiScores.push(1 - s);
    anomalyScores.push(r.features.anomaly_flag);
    stressLabels.push(r.stressBinary);
  });

  return {
    dataset: dataset.dataset,
    n: rows.length,
    heuristicBhiTierAccuracy: +(heuristicCorrect / Math.max(rows.length, 1)).toFixed(4),
    anomalyFlagAgreement: +(anomalyAgree / Math.max(rows.length, 1)).toFixed(4),
    stressBinaryAucBhi: trapezoidAuc(bhiScores, stressLabels),
    stressBinaryAucAnomaly: trapezoidAuc(anomalyScores, stressLabels),
    sanityCheckOnly: true,
    disclaimer_en: 'Signal-processing sanity check against stress/arousal proxy — NOT clinical validation.',
    labelDistribution: rows.reduce((acc, r) => {
      acc[r.label] = (acc[r.label] || 0) + 1;
      return acc;
    }, {}),
    rows: rows.slice(0, 5),
  };
}

module.exports = {
  FEATURE_NAMES,
  windowToFeatures,
  generateWesadStressProxySample,
  evaluateProxyDataset,
};
