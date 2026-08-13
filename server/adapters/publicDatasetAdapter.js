/**
 * Adapters mapping public wearable dataset windows → MedWear 17-dim feature schema.
 * Feature construction never reads labels — evaluation labels are kept separate.
 */

const { FEATURE_NAMES } = require('../services/extractFeatures');

function computeHealthScoreFromSignals(window = {}) {
  const meanHr = window.meanHr ?? 70;
  const hrv = window.hrv ?? 45;
  const steps = window.steps ?? 5000;
  const spo2 = window.spo2 ?? 97;
  const sleepH = window.sleepHours ?? 7;
  const hrScore = Math.max(0, Math.min(100, 100 - Math.abs(meanHr - 70) * 1.5));
  const hrvScore = Math.max(0, Math.min(100, (hrv / 60) * 100));
  const activityScore = Math.min(100, (steps / 8000) * 100);
  const spo2Score = Math.max(0, Math.min(100, (spo2 - 90) * 10));
  const sleepScore = Math.max(0, Math.min(100, (sleepH / 8) * 100));
  return hrScore * 0.25 + hrvScore * 0.2 + activityScore * 0.2 + spo2Score * 0.15 + sleepScore * 0.2;
}

/** Map physiological signals only — never reads label / condition / stress fields. */
function windowToFeatures(window = {}) {
  const meanHr = window.meanHr ?? 70;
  const stdHr = window.stdHr ?? 5;
  const spo2 = window.spo2 ?? 97;
  const steps = window.steps ?? 5000;
  const hrv = window.hrv ?? 45;
  const sleepH = window.sleepHours ?? 7;
  const score = computeHealthScoreFromSignals(window);

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

/** WESAD-inspired stress vs baseline proxy — labels kept separate from feature build. */
function generateWesadStressProxySample(n = 120, seed = 42, nSubjects = 15) {
  let s = seed;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  const gauss = (mu, sd) => mu + sd * Math.sqrt(-2 * Math.log(rnd() || 1e-9)) * Math.cos(2 * Math.PI * rnd());

  const windowsPerSubject = Math.ceil(n / nSubjects);
  const subjectBaselines = Array.from({ length: nSubjects }, () => gauss(72, 6));
  const windows = [];

  for (let i = 0; i < n; i++) {
    const subjectId = `S${String((i % nSubjects) + 1).padStart(2, '0')}`;
    const subjectIdx = parseInt(subjectId.slice(1), 10) - 1;
    const stress = i % 2 === 1;
    const baseHr = subjectBaselines[subjectIdx];
    const meanHr = gauss(stress ? baseHr + 18 : baseHr, stress ? 10 : 7);
    const hrv = gauss(stress ? 32 : 48, stress ? 8 : 10);
    const steps = Math.max(500, gauss(stress ? 2800 : 6200, 1500));
    const label = stress ? 'moderate' : 'low';
    windows.push({
      id: `WESAD-proxy-${String(i + 1).padStart(3, '0')}`,
      subjectId,
      condition: stress ? 'stress/task' : 'baseline',
      label,
      meanHr: +meanHr.toFixed(1),
      stdHr: +(stress ? 14 : 7),
      spo2: +(gauss(97, 1)).toFixed(1),
      hrv: +hrv.toFixed(1),
      steps: Math.round(steps),
      sleepHours: +(gauss(6.8, 0.8)).toFixed(2),
    });
  }

  return {
    dataset: 'WESAD-stress-proxy-sample',
    version: '1.1.0',
    n: windows.length,
    nSubjects,
    featureBuildUsesLabels: false,
    splitPolicy: 'subject-wise holdout (20%)',
    source_en:
      'Synthetic windows with HR/HRV shifts modeled on WESAD stress-vs-baseline literature — not raw WESAD subject data. Features built without reading labels.',
    source_zh: '按 WESAD 压力/基线文献范围合成的 HR/HRV 窗口 — 非原始 WESAD 数据；特征构建不读取标签。',
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

function bootstrapCi(values, statFn, iterations = 400, alpha = 0.05, seed = 42) {
  if (!values.length) return null;
  let s = seed;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  const stats = [];
  for (let i = 0; i < iterations; i++) {
    const sample = Array.from({ length: values.length }, () => values[Math.floor(rnd() * values.length)]);
    const v = statFn(sample);
    if (v != null && Number.isFinite(v)) stats.push(v);
  }
  if (!stats.length) return null;
  stats.sort((a, b) => a - b);
  const lo = stats[Math.floor((alpha / 2) * stats.length)];
  const hi = stats[Math.floor((1 - alpha / 2) * stats.length) - 1];
  return { low: +lo.toFixed(4), high: +hi.toFixed(4) };
}

function confusionMatrix3Class(predictions, gold) {
  const labels = ['low', 'moderate', 'high'];
  const m = Object.fromEntries(labels.map((l) => [l, Object.fromEntries(labels.map((g) => [g, 0]))]));
  predictions.forEach((p, i) => {
    const g = gold[i];
    if (m[p] && m[p][g] !== undefined) m[p][g] += 1;
  });
  return m;
}

function subjectWiseHoldout(rows, testFraction = 0.2, seed = 42) {
  const subjects = [...new Set(rows.map((r) => r.subjectId))].sort();
  let s = seed;
  const shuffled = [...subjects].sort(() => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s / 0xffffffff) - 0.5;
  });
  const nTest = Math.max(1, Math.round(subjects.length * testFraction));
  const testSet = new Set(shuffled.slice(0, nTest));
  return rows.filter((r) => testSet.has(r.subjectId));
}

function evaluateRowSet(rows) {
  let heuristicCorrect = 0;
  let anomalyAgree = 0;
  const bhiScores = [];
  const anomalyScores = [];
  const stressLabels = [];
  const bhiPreds = [];
  const bhiGold = [];

  rows.forEach((r) => {
    const s = r.features.health_score_norm;
    const pred = s >= 0.8 ? 'low' : s >= 0.6 ? 'moderate' : 'high';
    bhiPreds.push(pred);
    bhiGold.push(r.label);
    if (pred === r.label) heuristicCorrect += 1;
    const goldAnomaly = r.label !== 'low' ? 1 : 0;
    if (r.features.anomaly_flag === goldAnomaly) anomalyAgree += 1;
    bhiScores.push(1 - s);
    anomalyScores.push(r.features.anomaly_flag);
    stressLabels.push(r.stressBinary);
  });

  const n = Math.max(rows.length, 1);
  const perSubjectAcc = {};
  rows.forEach((r) => {
    const s = r.features.health_score_norm;
    const pred = s >= 0.8 ? 'low' : s >= 0.6 ? 'moderate' : 'high';
    if (!perSubjectAcc[r.subjectId]) perSubjectAcc[r.subjectId] = { correct: 0, total: 0 };
    perSubjectAcc[r.subjectId].total += 1;
    if (pred === r.label) perSubjectAcc[r.subjectId].correct += 1;
  });
  const subjectAccuracies = Object.values(perSubjectAcc).map((x) => +(x.correct / x.total).toFixed(4));

  return {
    n: rows.length,
    heuristicBhiTierAccuracy: +(heuristicCorrect / n).toFixed(4),
    anomalyFlagAgreement: +(anomalyAgree / n).toFixed(4),
    stressBinaryAucBhi: trapezoidAuc(bhiScores, stressLabels),
    stressBinaryAucAnomaly: trapezoidAuc(anomalyScores, stressLabels),
    bhiTierConfusionMatrix: confusionMatrix3Class(bhiPreds, bhiGold),
    perSubjectAccuracy: {
      min: subjectAccuracies.length ? Math.min(...subjectAccuracies) : null,
      max: subjectAccuracies.length ? Math.max(...subjectAccuracies) : null,
      mean: subjectAccuracies.length
        ? +(subjectAccuracies.reduce((a, b) => a + b, 0) / subjectAccuracies.length).toFixed(4)
        : null,
      nSubjects: Object.keys(perSubjectAcc).length,
    },
  };
}

function evaluateProxyDataset(dataset) {
  const rows = (dataset.windows || []).map((w) => ({
    id: w.id,
    subjectId: w.subjectId || 'unknown',
    label: w.label,
    condition: w.condition,
    stressBinary: w.condition === 'stress/task' || w.label !== 'low' ? 1 : 0,
    features: windowToFeatures(w),
  }));

  const allEval = evaluateRowSet(rows);
  const holdoutRows = subjectWiseHoldout(rows, 0.2, 42);
  const holdoutEval = evaluateRowSet(holdoutRows);

  const aucSamples = holdoutRows.map((r) => ({
    score: 1 - r.features.health_score_norm,
    label: r.stressBinary,
  }));
  const stressBinaryAucCi = bootstrapCi(
    aucSamples,
    (sample) => trapezoidAuc(sample.map((x) => x.score), sample.map((x) => x.label)),
  );

  return {
    dataset: dataset.dataset,
    n: rows.length,
    nSubjects: dataset.nSubjects || new Set(rows.map((r) => r.subjectId)).size,
    featureBuildUsesLabels: false,
    splitPolicy: 'subject-wise holdout (20%)',
    holdoutN: holdoutRows.length,
    ...allEval,
    holdout: {
      ...holdoutEval,
      stressBinaryAucBhiCi95: stressBinaryAucCi,
    },
    sanityCheckOnly: true,
    disclaimer_en:
      'Signal-processing sanity check against stress/arousal proxy — NOT clinical validation. WESAD stress labels are not disease labels; proxy mapping may inflate separability.',
    disclaimer_zh: '针对压力/唤醒代理的信号处理健全性检查 — 非临床验证。WESAD 压力标签非疾病标签；代理映射可能放大可区分性。',
    labelDistribution: rows.reduce((acc, r) => {
      acc[r.label] = (acc[r.label] || 0) + 1;
      return acc;
    }, {}),
    rows: rows.slice(0, 5),
  };
}

module.exports = {
  FEATURE_NAMES,
  computeHealthScoreFromSignals,
  windowToFeatures,
  generateWesadStressProxySample,
  evaluateProxyDataset,
  trapezoidAuc,
  subjectWiseHoldout,
  bootstrapCi,
};
