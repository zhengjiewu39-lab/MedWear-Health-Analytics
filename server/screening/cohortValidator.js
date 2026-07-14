/**
 * Real clinical cohort validation — compare simulated MedWear outcomes against
 * SEER / NLST / China NCCR reference subsets; report diagnostic and outcome metrics.
 */

'use strict';

const { getCohort, getOutcomeSummary, CATEGORIES } = require('./outcomeModel');
const {
  CLINICAL_REFERENCE_SUBSETS,
  listReferenceSubsets,
  getReferenceSubset,
} = require('./clinicalReferenceData');

function rate(num, den) {
  if (!den) return null;
  return +(num / den).toFixed(4);
}

function mean(arr) {
  if (!arr.length) return null;
  return +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(4);
}

function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function pctDelta(sim, ref) {
  if (sim == null || ref == null) return null;
  return +(sim - ref).toFixed(4);
}

function withinTolerance(sim, ref, tol = 0.12) {
  if (sim == null || ref == null) return null;
  return Math.abs(sim - ref) <= tol;
}

/** Confusion matrix for intervention-arm screening vs true malignancy. */
function computeConfusionMatrix(patients, { scoreThreshold = 0.35 } = {}) {
  const iv = patients.filter((p) => p.arm === 'intervention');
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;

  iv.forEach((p) => {
    const disease = Boolean(p.malignant);
    const predicted = p.anomalyFlagged || p.riskTier === 'high' || p.riskScore >= scoreThreshold;
    if (predicted && disease) tp += 1;
    else if (predicted && !disease) fp += 1;
    else if (!predicted && !disease) tn += 1;
    else fn += 1;
  });

  return { tp, fp, tn, fn, n: iv.length };
}

function metricsFromConfusion({ tp, fp, tn, fn }) {
  const sensitivity = rate(tp, tp + fn);
  const specificity = rate(tn, tn + fp);
  const ppv = rate(tp, tp + fp);
  const npv = rate(tn, tn + fn);
  const accuracy = rate(tp + tn, tp + fp + tn + fn);
  const f1 = (tp + fp === 0 || tp + fn === 0 || sensitivity == null || ppv == null)
    ? null
    : +((2 * sensitivity * ppv) / (sensitivity + ppv + 1e-9)).toFixed(4);
  return { sensitivity, specificity, ppv, npv, accuracy, f1 };
}

/** ROC-AUC from riskScore vs malignant label (intervention arm). */
function computeAUC(patients) {
  const iv = patients.filter((p) => p.arm === 'intervention');
  if (iv.length < 10) return { auc: null, points: [] };

  const pairs = iv.map((p) => ({ score: p.riskScore, label: p.malignant ? 1 : 0 }));
  const pos = pairs.filter((x) => x.label === 1).length;
  const neg = pairs.length - pos;
  if (!pos || !neg) return { auc: null, points: [] };

  const thresholds = [...new Set(pairs.map((x) => x.score))].sort((a, b) => b - a);
  const points = thresholds.map((t) => {
    let tp = 0;
    let fp = 0;
    pairs.forEach(({ score, label }) => {
      const pred = score >= t ? 1 : 0;
      if (pred && label) tp += 1;
      if (pred && !label) fp += 1;
    });
    return {
      threshold: +t.toFixed(3),
      tpr: tp / pos,
      fpr: fp / neg,
    };
  });

  points.unshift({ threshold: 1.01, tpr: 0, fpr: 0 });
  points.push({ threshold: 0, tpr: 1, fpr: 1 });

  let auc = 0;
  for (let i = 1; i < points.length; i += 1) {
    const w = points[i].fpr - points[i - 1].fpr;
    const h = (points[i].tpr + points[i - 1].tpr) / 2;
    auc += w * h;
  }

  return { auc: +Math.max(0, Math.min(1, auc)).toFixed(4), points: points.slice(0, 12) };
}

function validateOutcomes(summary, references) {
  const iv = summary.arms.intervention;
  const uc = summary.arms.usual_care;
  const cmp = summary.comparison;
  const seer = references.SEER;
  const nlst = references.NLST;
  const nccr = references.CHINA_NCCR;

  const lungIv = summary.byCategory.find((c) => c.category === 'lung_cancer');
  const lungUc = lungIv ? { early: lungIv.control.earlyStageRate } : {};

  return {
    earlyDiagnosisRate: {
      simulated: {
        intervention: iv.earlyStageRate,
        control: uc.earlyStageRate,
        delta: cmp.earlyStageRate.delta,
      },
      reference: {
        NLST_stageShift: nlst.lungScreening.stageShift,
        CHINA_NCCR_lung: {
          withScreening: nccr.programs.lung_high_risk.earlyStageRateWithScreening,
          without: nccr.programs.lung_high_risk.earlyStageRateWithout,
        },
        SEER_usualCareMix: seer.cancers.lung_nsclc.earlyStageShareAtDx,
      },
      alignment: {
        interventionVsNlstScreened: withinTolerance(iv.earlyStageRate, nlst.lungScreening.stageShift.earlyStageRateScreened, 0.15),
        controlVsNlstControl: withinTolerance(uc.earlyStageRate, nlst.lungScreening.stageShift.earlyStageRateControl, 0.15),
        directionCorrect: (iv.earlyStageRate || 0) > (uc.earlyStageRate || 0),
      },
    },
    treatmentInitiationDelay: {
      simulated: {
        interventionMedianDays: iv.medianDaysToTreatment,
        controlMedianDays: uc.medianDaysToTreatment,
        interventionRate90d: iv.treatmentInitiationRate,
        controlRate90d: uc.treatmentInitiationRate,
        deltaDays: cmp.medianDaysToTreatment.delta,
      },
      reference: {
        SEER_usualCareMedianDays: seer.outcomes.medianDaysToTreatmentUsualCare,
        CHINA_NCCR_lung_screened: nccr.programs.lung_high_risk.medianDaysToTreatmentScreened,
        CHINA_NCCR_lung_unscreened: nccr.programs.lung_high_risk.medianDaysToTreatmentUnscreened,
      },
      alignment: {
        interventionFasterThanControl: (iv.medianDaysToTreatment || 999) < (uc.medianDaysToTreatment || 0),
        interventionVsChinaScreened: withinTolerance(iv.medianDaysToTreatment, nccr.programs.lung_high_risk.medianDaysToTreatmentScreened, 10),
      },
    },
    survival5yImprovement: {
      simulated: {
        intervention: iv.observedSurvival5yRate ?? iv.meanSurvival5y,
        control: uc.observedSurvival5yRate ?? uc.meanSurvival5y,
        absoluteGain: cmp.observedSurvival5yRate?.delta ?? cmp.meanSurvival5y?.delta,
      },
      reference: {
        CHINA_NCCR_expectedGain: nccr.survivalImprovementWithEarlyDx,
        SEER_stageSurvival: seer.cancers,
      },
      alignment: {
        directionCorrect: (iv.meanSurvival5y || 0) > (uc.meanSurvival5y || 0),
        gainWithinLiteratureRange: (() => {
          const g = cmp.meanSurvival5y?.delta;
          return g != null && g >= 0.08 && g <= 0.35;
        })(),
      },
    },
    byCategoryVsSeer: summary.byCategory
      .filter((c) => c.malignant)
      .map((c) => {
        const seerKey = c.category === 'lung_cancer' ? 'lung_nsclc'
          : c.category === 'colorectal_cancer' ? 'colorectal' : 'breast';
        const ref = seer.cancers[seerKey];
        const simSurv = c.intervention.meanSurvival5y;
        const refSurv = ref?.survival5yByStage ? mean(Object.values(ref.survival5yByStage)) : null;
        return {
          category: c.category,
          label: c.label,
          label_en: c.label_en,
          simulatedEarlyStageRate: c.intervention.earlyStageRate,
          referenceEarlyStageShare: ref?.earlyStageShareAtDx,
          simulatedMeanSurvival5y: simSurv,
          referenceMeanStageSurvival: refSurv,
          earlyStageDelta: pctDelta(c.intervention.earlyStageRate, ref?.earlyStageShareAtDx),
        };
      }),
  };
}

function validateDiagnosticMetrics(confusion, aucResult, references) {
  const metrics = metricsFromConfusion(confusion);
  const nlst = references.NLST.lungScreening;
  const crc = references.CHINA_NCCR.programs.colorectal_fecal;
  const breast = references.CHINA_NCCR.programs.breast_mammography;

  return {
    confusionMatrix: confusion,
    metrics: {
      sensitivity: metrics.sensitivity,
      specificity: metrics.specificity,
      ppv: metrics.ppv,
      npv: metrics.npv,
      accuracy: metrics.accuracy,
      f1: metrics.f1,
      auc: aucResult.auc,
    },
    roc: aucResult.points,
    referenceComparison: {
      NLST_lung: {
        sensitivity: nlst.sensitivity,
        specificity: nlst.specificity,
        ppv: nlst.ppv,
        sensitivityDelta: pctDelta(metrics.sensitivity, nlst.sensitivity),
        specificityDelta: pctDelta(metrics.specificity, nlst.specificity),
        ppvDelta: pctDelta(metrics.ppv, nlst.ppv),
      },
      CHINA_NCCR_colorectal: {
        sensitivity: crc.sensitivity,
        specificity: crc.specificity,
        ppv: crc.ppv,
      },
      CHINA_NCCR_breast: {
        sensitivity: breast.sensitivity,
        specificity: breast.specificity,
        ppv: breast.ppv,
      },
    },
    interpretation: {
      zh: '基于干预组可穿戴风险分层 vs 模拟金标准（恶性类别）的操作特征；与 NLST/CRC/乳腺筛查文献区间对照。',
      en: 'Operating characteristics of wearable risk stratification vs simulated malignancy gold standard, benchmarked against NLST/CRC/breast screening literature.',
    },
  };
}

function overallVerdict(outcomeVal, diagnosticVal) {
  const checks = [
    outcomeVal.earlyDiagnosisRate.alignment.directionCorrect,
    outcomeVal.treatmentInitiationDelay.alignment.interventionFasterThanControl,
    outcomeVal.survival5yImprovement.alignment.directionCorrect,
    diagnosticVal.metrics.auc != null && diagnosticVal.metrics.auc >= 0.65,
  ];
  const passed = checks.filter(Boolean).length;
  return {
    passed,
    total: checks.length,
    status: passed >= 3 ? 'aligned' : passed >= 2 ? 'partial' : 'review',
    status_zh: passed >= 3 ? '与文献方向一致' : passed >= 2 ? '部分一致' : '需复核',
  };
}

/**
 * Run full clinical cohort validation.
 * @param {{ seed?: number, n?: number, scoreThreshold?: number }} opts
 */
function runCohortValidation(opts = {}) {
  const { patients, meta } = getCohort(opts);
  const summary = getOutcomeSummary(opts);
  const references = CLINICAL_REFERENCE_SUBSETS;

  const confusion = computeConfusionMatrix(patients, opts);
  const aucResult = computeAUC(patients);
  const outcomeValidation = validateOutcomes(summary, references);
  const diagnosticValidation = validateDiagnosticMetrics(confusion, aucResult, references);
  const verdict = overallVerdict(outcomeValidation, diagnosticValidation);

  return {
    engine: 'MedWear-CohortValidator-v1',
    evaluatedAt: new Date().toISOString(),
    cohort: {
      n: meta.n,
      seed: meta.seed,
      name: meta.name,
    },
    referenceSubsets: listReferenceSubsets(),
    references: {
      SEER: { id: 'SEER', cancers: Object.keys(references.SEER.cancers) },
      NLST: { id: 'NLST', focus: 'lungScreening' },
      CHINA_NCCR: { id: 'CHINA_NCCR', programs: Object.keys(references.CHINA_NCCR.programs) },
    },
    outcomeValidation,
    diagnosticValidation,
    verdict,
    headline: {
      earlyDiagnosisRate_iv: summary.arms.intervention.earlyStageRate,
      treatmentMedianDays_iv: summary.arms.intervention.medianDaysToTreatment,
      survival5yGain: summary.comparison.meanSurvival5y.delta,
      sensitivity: diagnosticValidation.metrics.sensitivity,
      specificity: diagnosticValidation.metrics.specificity,
      ppv: diagnosticValidation.metrics.ppv,
      auc: diagnosticValidation.metrics.auc,
    },
  };
}

module.exports = {
  runCohortValidation,
  computeConfusionMatrix,
  computeAUC,
  metricsFromConfusion,
  validateOutcomes,
  validateDiagnosticMetrics,
  listReferenceSubsets,
  getReferenceSubset,
  CLINICAL_REFERENCE_SUBSETS,
};
