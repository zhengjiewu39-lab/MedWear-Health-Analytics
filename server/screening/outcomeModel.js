/**
 * Screening-outcome cohort model.
 *
 * Simulates a large, physiologically realistic cohort to support the thesis:
 * "Early prediction/screening from consumer wearable proxy signals improves
 * stage-at-diagnosis, treatment initiation and simulated survival for chronic
 * disease and cancer, compared with a usual-care (unscreened) control arm."
 *
 * The generator is DETERMINISTIC (seeded) so the served API and the exported
 * benchmark dataset are identical and reproducible.
 *
 * Physiological baselines and stage-specific survival are anchored to published
 * ranges / registry statistics (documented inline). All data are SYNTHETIC — no
 * real patients — and intended for methodology demonstration only.
 */

'use strict';

// ── Seeded RNG (mulberry32) + Gaussian via Box–Muller ──────────────────────
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeRng(seed) {
  const rand = mulberry32(seed);
  let spare = null;
  function gauss(mean = 0, sd = 1) {
    if (spare !== null) {
      const v = spare;
      spare = null;
      return mean + sd * v;
    }
    let u = 0;
    let v = 0;
    let s = 0;
    do {
      u = rand() * 2 - 1;
      v = rand() * 2 - 1;
      s = u * u + v * v;
    } while (s >= 1 || s === 0);
    const mul = Math.sqrt((-2 * Math.log(s)) / s);
    spare = v * mul;
    return mean + sd * (u * mul);
  }
  return {
    next: rand,
    gauss,
    clampGauss: (mean, sd, lo, hi) => Math.min(hi, Math.max(lo, gauss(mean, sd))),
    pick: (arr) => arr[Math.floor(rand() * arr.length)],
    chance: (p) => rand() < p,
    weighted: (entries) => {
      // entries: [[value, weight], ...]
      const total = entries.reduce((s, e) => s + e[1], 0);
      let r = rand() * total;
      for (const [val, w] of entries) {
        r -= w;
        if (r <= 0) return val;
      }
      return entries[entries.length - 1][0];
    },
  };
}

// ── Clinical parameters (documented, literature-anchored) ──────────────────

/**
 * Disease categories with prevalence in a 40–80 screening-eligible population,
 * and physiological signal deviations induced by (sub)clinical disease.
 * Signal deltas are applied on top of the healthy baseline.
 */
const CATEGORIES = [
  {
    key: 'healthy', label: '健康 / 低风险', label_en: 'Healthy / low risk',
    prevalence: 0.62, malignant: false,
  },
  {
    key: 'lung_cancer', label: '肺癌', label_en: 'Lung cancer',
    prevalence: 0.06, malignant: true,
    // NLST-eligible heavy-smoker enrichment; strong smoking dependence
    signal: { restingHR: +7, hrv: -11, spo2: -1.8, steps: -2200, sleepHours: -0.6, respRate: +3.0, skinTempDelta: +0.25 },
    // 5-year relative survival by stage (SEER, NSCLC approximate)
    survivalByStage: { I: 0.68, II: 0.47, III: 0.30, IV: 0.09 },
  },
  {
    key: 'colorectal_cancer', label: '结直肠癌', label_en: 'Colorectal cancer',
    prevalence: 0.05, malignant: true,
    signal: { restingHR: +5, hrv: -9, spo2: -0.5, steps: -1800, sleepHours: -0.4, respRate: +0.6, skinTempDelta: +0.2 },
    // SEER 5-year (localized/regional/distant → I/II · III · IV)
    survivalByStage: { I: 0.91, II: 0.82, III: 0.72, IV: 0.15 },
  },
  {
    key: 'breast_cancer', label: '乳腺癌', label_en: 'Breast cancer',
    prevalence: 0.05, malignant: true, femaleOnly: true,
    signal: { restingHR: +4, hrv: -8, spo2: -0.2, steps: -1400, sleepHours: -0.5, respRate: +0.4, skinTempDelta: +0.3 },
    survivalByStage: { I: 0.99, II: 0.93, III: 0.86, IV: 0.31 },
  },
  {
    key: 'hypertension', label: '高血压', label_en: 'Hypertension',
    prevalence: 0.12, malignant: false, chronic: true,
    signal: { restingHR: +6, hrv: -6, spo2: -0.1, steps: -600, sleepHours: -0.3, respRate: +0.3, systolicBP: +24, skinTempDelta: 0 },
  },
  {
    key: 'diabetes', label: '2 型糖尿病', label_en: 'Type 2 diabetes',
    prevalence: 0.10, malignant: false, chronic: true,
    signal: { restingHR: +5, hrv: -7, spo2: -0.2, steps: -900, sleepHours: -0.4, respRate: +0.2, fastingGlucose: +2.6, bmi: +2.8, skinTempDelta: 0 },
  },
];

/**
 * Stage-shift by arm. Early screening moves diagnoses to earlier stages.
 * Distributions sum to 1. Anchored to screening trial stage-shift effects
 * (e.g., NLST stage I shift; CRC/breast screening downstaging).
 */
const STAGE_DISTRIBUTION = {
  intervention: { I: 0.46, II: 0.29, III: 0.18, IV: 0.07 },
  usual_care: { I: 0.17, II: 0.26, III: 0.31, IV: 0.26 },
};

/** Chronic-disease control (target organ protection) achieved by arm. */
const CHRONIC_CONTROL_RATE = { intervention: 0.74, usual_care: 0.47 };

/** Treatment initiation within 90 days of diagnosis, by arm. */
const TREATMENT_INITIATION_RATE = { intervention: 0.92, usual_care: 0.67 };

/** Diagnosis → treatment interval (days): mean/sd by arm. */
const TIME_TO_TREATMENT = {
  intervention: { mean: 18, sd: 8, min: 3 },
  usual_care: { mean: 43, sd: 22, min: 7 },
};

/** Untreated malignant disease survival penalty (multiplicative on 5y survival). */
const UNTREATED_SURVIVAL_FACTOR = 0.55;

const STAGES = ['I', 'II', 'III', 'IV'];

// ── Physiology generation ──────────────────────────────────────────────────

function baselineSignals(rng, age, sex) {
  const ageOver40 = Math.max(0, age - 40);
  return {
    restingHR: rng.clampGauss(68, 8, 46, 98),
    // HRV (RMSSD) declines ~0.4 ms/yr after 40
    hrv: rng.clampGauss(46 - ageOver40 * 0.4, 13, 10, 95),
    spo2: rng.clampGauss(97.6, 1.0, 91, 100),
    steps: Math.round(rng.clampGauss(7300, 2600, 600, 17000)),
    sleepHours: +rng.clampGauss(7.0, 0.95, 3.8, 10.2).toFixed(1),
    systolicBP: Math.round(rng.clampGauss(120 + ageOver40 * 0.35, 11, 92, 175)),
    fastingGlucose: +rng.clampGauss(5.1, 0.55, 3.8, 9.5).toFixed(1),
    bmi: +rng.clampGauss(sex === 'F' ? 23.8 : 24.9, 3.4, 16.5, 41).toFixed(1),
    respRate: Math.round(rng.clampGauss(15, 1.8, 10, 24)),
    skinTempDelta: +rng.gauss(0, 0.22).toFixed(2),
  };
}

function applyDisease(signals, category, smoker, rng) {
  if (!category.signal) return signals;
  const out = { ...signals };
  for (const [k, delta] of Object.entries(category.signal)) {
    // add mild individual variation so deviations are not identical
    const jitter = 1 + rng.gauss(0, 0.15);
    out[k] = (out[k] ?? 0) + delta * jitter;
  }
  // smokers with lung disease: extra SpO2 drop + resting HR rise
  if (category.key === 'lung_cancer' && smoker) {
    out.spo2 -= 1.0;
    out.restingHR += 3;
  }
  // round/clamp
  out.restingHR = Math.round(Math.min(120, Math.max(45, out.restingHR)));
  out.hrv = Math.round(Math.min(95, Math.max(6, out.hrv)));
  out.spo2 = +Math.min(100, Math.max(85, out.spo2)).toFixed(1);
  out.steps = Math.round(Math.max(300, out.steps));
  out.sleepHours = +Math.max(3.2, out.sleepHours).toFixed(1);
  out.systolicBP = Math.round(Math.min(210, Math.max(90, out.systolicBP)));
  out.fastingGlucose = +Math.min(18, Math.max(3.6, out.fastingGlucose)).toFixed(1);
  out.bmi = +Math.max(15, out.bmi).toFixed(1);
  out.respRate = Math.round(Math.min(30, Math.max(9, out.respRate)));
  out.skinTempDelta = +out.skinTempDelta.toFixed(2);
  return out;
}

/**
 * Transparent wearable risk score (0–1) from proxy-signal deviations vs
 * healthy references — mirrors the analyticsCore rule engine philosophy.
 */
function computeRiskScore(s) {
  let z = 0;
  z += Math.max(0, (s.restingHR - 78) / 12);
  z += Math.max(0, (46 - s.hrv) / 18);
  z += Math.max(0, (97 - s.spo2) / 2.2);
  z += Math.max(0, (7000 - s.steps) / 3500);
  z += Math.max(0, (s.systolicBP - 135) / 18);
  z += Math.max(0, (s.fastingGlucose - 6.1) / 1.6);
  z += Math.max(0, (s.respRate - 18) / 3.5);
  z += Math.max(0, (s.skinTempDelta - 0.3) / 0.4);
  // logistic squashing
  const score = 1 / (1 + Math.exp(-(z - 2.3)));
  return +score.toFixed(3);
}

function riskTier(score) {
  if (score >= 0.6) return 'high';
  if (score >= 0.3) return 'moderate';
  return 'low';
}

// ── Cohort generation ──────────────────────────────────────────────────────

const DEFAULT_SEED = 20260709;
/** Experimental cohort size — intervention + usual-care arms (50/50 split). */
const DEFAULT_N = 5000;

function generateArmCategory(rng, sex) {
  const entries = CATEGORIES
    .filter((c) => !(c.femaleOnly && sex !== 'F'))
    .map((c) => [c.key, c.prevalence]);
  const key = rng.weighted(entries);
  return CATEGORIES.find((c) => c.key === key);
}

function sampleStage(rng, arm) {
  const dist = STAGE_DISTRIBUTION[arm];
  return rng.weighted(STAGES.map((s) => [s, dist[s]]));
}

function buildPatient(rng, index, arm) {
  const sex = rng.chance(0.5) ? 'F' : 'M';
  const age = Math.round(rng.clampGauss(59, 9.5, 40, 82));
  const smoker = rng.chance(sex === 'M' ? 0.34 : 0.19);
  const familyHistory = rng.chance(0.22);
  const category = generateArmCategory(rng, sex);

  let signals = baselineSignals(rng, age, sex);
  signals = applyDisease(signals, category, smoker, rng);
  const riskScore = computeRiskScore(signals);
  const tier = riskTier(riskScore);

  const patient = {
    id: `${arm === 'intervention' ? 'IV' : 'UC'}-${String(index).padStart(4, '0')}`,
    arm,
    age,
    sex,
    smoker,
    familyHistory,
    category: category.key,
    categoryLabel: category.label,
    categoryLabel_en: category.label_en,
    malignant: Boolean(category.malignant),
    chronic: Boolean(category.chronic),
    signals,
    riskScore,
    riskTier: tier,
  };

  // ── Care pathway ──
  const screened = arm === 'intervention';
  patient.screened = screened;
  // Intervention arm: wearable flags high/moderate risk → recommended exam.
  patient.anomalyFlagged = screened && tier !== 'low';
  patient.examRecommended = patient.anomalyFlagged || (screened && category.malignant && rng.chance(0.6));

  // Exam uptake: high in intervention; control only presents on symptoms.
  if (screened) {
    patient.examBooked = patient.examRecommended && rng.chance(0.9);
    patient.examCompleted = patient.examBooked && rng.chance(0.93);
  } else {
    // usual care: symptom-driven, later
    patient.examBooked = category.malignant ? rng.chance(0.55) : rng.chance(0.4);
    patient.examCompleted = patient.examBooked && rng.chance(0.85);
  }

  if (category.malignant) {
    // Diagnosis only for those who complete an exam OR (control) become symptomatic later
    const diagnosed = patient.examCompleted || (!screened && rng.chance(0.5));
    patient.diagnosed = diagnosed;
    if (diagnosed) {
      const stage = sampleStage(rng, arm);
      patient.stageAtDiagnosis = stage;
      patient.earlyStage = stage === 'I' || stage === 'II';
      const initiated = rng.chance(TREATMENT_INITIATION_RATE[arm]);
      patient.treatmentStarted = initiated;
      if (initiated) {
        const cfg = TIME_TO_TREATMENT[arm];
        patient.daysToTreatment = Math.round(Math.max(cfg.min, rng.gauss(cfg.mean, cfg.sd)));
      } else {
        patient.daysToTreatment = null;
      }
      // Simulated 5-year survival probability
      let surv = category.survivalByStage[stage];
      if (!initiated) surv *= UNTREATED_SURVIVAL_FACTOR;
      patient.survival5yProb = +surv.toFixed(3);
      patient.survived5y = rng.chance(surv);
    } else {
      patient.stageAtDiagnosis = null;
      patient.earlyStage = null;
      patient.treatmentStarted = false;
      patient.daysToTreatment = null;
      patient.survival5yProb = null;
      patient.survived5y = null;
    }
  } else if (category.chronic) {
    const controlled = rng.chance(CHRONIC_CONTROL_RATE[arm]);
    patient.diagnosed = patient.examCompleted || (!screened && rng.chance(0.6));
    patient.treatmentStarted = patient.diagnosed && rng.chance(arm === 'intervention' ? 0.9 : 0.7);
    patient.controlled = patient.treatmentStarted ? controlled : rng.chance(arm === 'intervention' ? 0.5 : 0.3);
    // complication-free at 5y proxy
    patient.complicationFree5y = rng.chance(patient.controlled ? 0.9 : 0.68);
  } else {
    patient.diagnosed = false;
    patient.treatmentStarted = false;
  }

  return patient;
}

let CACHE = null;

function generateCohort({ seed = DEFAULT_SEED, n = DEFAULT_N } = {}) {
  const rng = makeRng(seed);
  const half = Math.floor(n / 2);
  const patients = [];
  for (let i = 1; i <= half; i += 1) patients.push(buildPatient(rng, i, 'intervention'));
  for (let i = 1; i <= n - half; i += 1) patients.push(buildPatient(rng, i, 'usual_care'));
  return {
    meta: {
      name: 'MedWear-Screening-Outcome-Cohort-v1',
      version: '1.0.0',
      license: 'CC-BY-4.0',
      seed,
      n: patients.length,
      nIntervention: patients.filter((p) => p.arm === 'intervention').length,
      nControl: patients.filter((p) => p.arm === 'usual_care').length,
      synthetic: true,
      generatedAt: new Date().toISOString(),
    },
    patients,
  };
}

function getCohort(opts) {
  if (!CACHE) CACHE = generateCohort(opts);
  return CACHE;
}

// ── Aggregation / analytics ────────────────────────────────────────────────

function mean(arr) {
  const v = arr.filter((x) => x != null);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
}

function median(arr) {
  const v = arr.filter((x) => x != null).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

function rate(num, den) {
  return den ? +(num / den).toFixed(4) : null;
}

function armMalignant(patients, arm) {
  return patients.filter((p) => p.arm === arm && p.malignant && p.diagnosed);
}

function summarizeArm(patients, arm) {
  const diagnosed = armMalignant(patients, arm);
  const treated = diagnosed.filter((p) => p.treatmentStarted);
  const earlyStage = diagnosed.filter((p) => p.earlyStage);
  const chronic = patients.filter((p) => p.arm === arm && p.chronic);
  const chronicControlled = chronic.filter((p) => p.controlled);

  const stageCounts = { I: 0, II: 0, III: 0, IV: 0 };
  diagnosed.forEach((p) => { if (p.stageAtDiagnosis) stageCounts[p.stageAtDiagnosis] += 1; });

  return {
    arm,
    n: patients.filter((p) => p.arm === arm).length,
    diagnosedMalignant: diagnosed.length,
    earlyStageRate: rate(earlyStage.length, diagnosed.length),
    treatmentInitiationRate: rate(treated.length, diagnosed.length),
    medianDaysToTreatment: median(treated.map((p) => p.daysToTreatment)),
    meanSurvival5y: mean(diagnosed.map((p) => p.survival5yProb)),
    observedSurvival5yRate: rate(diagnosed.filter((p) => p.survived5y).length, diagnosed.length),
    chronicN: chronic.length,
    chronicControlRate: rate(chronicControlled.length, chronic.length),
    stageDistribution: stageCounts,
  };
}

function pctDelta(a, b) {
  if (a == null || b == null) return null;
  return +(a - b).toFixed(4);
}

/** Relative improvement: (IV − UC) / UC — thesis headline effect size. */
function relativeImprovement(iv, uc) {
  if (iv == null || uc == null || uc === 0) return null;
  return +((iv - uc) / uc).toFixed(4);
}

function getOutcomeSummary(opts) {
  const { patients, meta } = getCohort(opts);
  const iv = summarizeArm(patients, 'intervention');
  const uc = summarizeArm(patients, 'usual_care');

  const comparison = {
    earlyStageRate: { intervention: iv.earlyStageRate, control: uc.earlyStageRate, delta: pctDelta(iv.earlyStageRate, uc.earlyStageRate) },
    treatmentInitiationRate: { intervention: iv.treatmentInitiationRate, control: uc.treatmentInitiationRate, delta: pctDelta(iv.treatmentInitiationRate, uc.treatmentInitiationRate) },
    medianDaysToTreatment: { intervention: iv.medianDaysToTreatment, control: uc.medianDaysToTreatment, delta: pctDelta(iv.medianDaysToTreatment, uc.medianDaysToTreatment) },
    meanSurvival5y: { intervention: iv.meanSurvival5y, control: uc.meanSurvival5y, delta: pctDelta(iv.meanSurvival5y, uc.meanSurvival5y) },
    observedSurvival5yRate: { intervention: iv.observedSurvival5yRate, control: uc.observedSurvival5yRate, delta: pctDelta(iv.observedSurvival5yRate, uc.observedSurvival5yRate) },
    chronicControlRate: { intervention: iv.chronicControlRate, control: uc.chronicControlRate, delta: pctDelta(iv.chronicControlRate, uc.chronicControlRate) },
  };

  /** Thesis-critical headline metrics (screened vs control). */
  const headline = {
    earlyDiagnosisRate: {
      label: '早期诊断率 (I/II 期)',
      label_en: 'Early diagnosis rate (stage I/II)',
      intervention: iv.earlyStageRate,
      control: uc.earlyStageRate,
      absoluteDelta: comparison.earlyStageRate.delta,
      relativeImprovement: relativeImprovement(iv.earlyStageRate, uc.earlyStageRate),
    },
    treatmentRate: {
      label: '治疗启动率 (90 天)',
      label_en: 'Treatment initiation rate (90d)',
      intervention: iv.treatmentInitiationRate,
      control: uc.treatmentInitiationRate,
      absoluteDelta: comparison.treatmentInitiationRate.delta,
      relativeImprovement: relativeImprovement(iv.treatmentInitiationRate, uc.treatmentInitiationRate),
    },
    survival5y: {
      label: '模拟 5 年存活率',
      label_en: 'Simulated 5-year survival',
      intervention: iv.observedSurvival5yRate ?? iv.meanSurvival5y,
      control: uc.observedSurvival5yRate ?? uc.meanSurvival5y,
      absoluteDelta: comparison.observedSurvival5yRate.delta ?? comparison.meanSurvival5y.delta,
      relativeImprovement: relativeImprovement(
        iv.observedSurvival5yRate ?? iv.meanSurvival5y,
        uc.observedSurvival5yRate ?? uc.meanSurvival5y,
      ),
    },
  };

  // per-category comparison (malignant only for survival)
  const byCategory = CATEGORIES.filter((c) => c.key !== 'healthy').map((c) => {
    const ivC = patients.filter((p) => p.arm === 'intervention' && p.category === c.key && p.diagnosed);
    const ucC = patients.filter((p) => p.arm === 'usual_care' && p.category === c.key && p.diagnosed);
    const build = (list) => ({
      diagnosed: list.length,
      earlyStageRate: c.malignant ? rate(list.filter((p) => p.earlyStage).length, list.length) : null,
      treatmentRate: rate(list.filter((p) => p.treatmentStarted).length, list.length),
      meanSurvival5y: c.malignant ? mean(list.map((p) => p.survival5yProb)) : null,
      controlRate: c.chronic ? rate(list.filter((p) => p.controlled).length, list.length) : null,
    });
    return {
      category: c.key,
      label: c.label,
      label_en: c.label_en,
      malignant: Boolean(c.malignant),
      chronic: Boolean(c.chronic),
      intervention: build(ivC),
      control: build(ucC),
    };
  });

  return {
    meta,
    headline,
    arms: { intervention: iv, usual_care: uc },
    comparison,
    byCategory,
    stageDistribution: {
      intervention: iv.stageDistribution,
      usual_care: uc.stageDistribution,
    },
    params: {
      stageDistribution: STAGE_DISTRIBUTION,
      treatmentInitiationRate: TREATMENT_INITIATION_RATE,
      timeToTreatment: TIME_TO_TREATMENT,
      chronicControlRate: CHRONIC_CONTROL_RATE,
      untreatedSurvivalFactor: UNTREATED_SURVIVAL_FACTOR,
    },
  };
}

/** Intervention-arm conversion funnel from continuous signal to outcome. */
function getFunnel(opts) {
  const { patients } = getCohort(opts);
  const iv = patients.filter((p) => p.arm === 'intervention');
  const n = iv.length;
  const steps = [
    { key: 'monitored', label: '持续可穿戴监测', label_en: 'Continuous monitoring', count: n },
    { key: 'anomaly_flagged', label: '异常信号标记', label_en: 'Anomaly flagged', count: iv.filter((p) => p.anomalyFlagged).length },
    { key: 'risk_stratified', label: '风险分层（中/高）', label_en: 'Risk-stratified (mod/high)', count: iv.filter((p) => p.riskTier !== 'low').length },
    { key: 'exam_booked', label: '体检预约', label_en: 'Exam booked', count: iv.filter((p) => p.examBooked).length },
    { key: 'exam_completed', label: '完成检查', label_en: 'Exam completed', count: iv.filter((p) => p.examCompleted).length },
    { key: 'diagnosed', label: '确诊（含分期）', label_en: 'Diagnosed & staged', count: iv.filter((p) => p.diagnosed).length },
    { key: 'treatment_started', label: '启动治疗', label_en: 'Treatment started', count: iv.filter((p) => p.treatmentStarted).length },
  ];
  return {
    arm: 'intervention',
    total: n,
    steps: steps.map((s) => ({ ...s, rate: rate(s.count, n) })),
  };
}

/** Stage-specific survival reference table (for methodology display). */
function getSurvivalReference() {
  return CATEGORIES.filter((c) => c.malignant).map((c) => ({
    category: c.key,
    label: c.label,
    label_en: c.label_en,
    survivalByStage: c.survivalByStage,
  }));
}

function resetCache() { CACHE = null; }

module.exports = {
  generateCohort,
  getCohort,
  getOutcomeSummary,
  getFunnel,
  getSurvivalReference,
  resetCache,
  CATEGORIES,
  STAGE_DISTRIBUTION,
  DEFAULT_SEED,
  DEFAULT_N,
};
