const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const {
  runCohortValidation,
  computeConfusionMatrix,
  computeAUC,
  metricsFromConfusion,
  listReferenceSubsets,
  getReferenceSubset,
} = require('../screening/cohortValidator');
const { getCohort } = require('../screening/outcomeModel');

describe('clinical cohort validator', () => {
  test('loads SEER/NLST/China NCCR reference subsets', () => {
    const refs = listReferenceSubsets();
    assert.equal(refs.length, 3);
    assert.ok(getReferenceSubset('SEER')?.cancers?.lung_nsclc);
    assert.ok(getReferenceSubset('NLST')?.lungScreening?.sensitivity);
    assert.ok(getReferenceSubset('CHINA_NCCR')?.programs?.lung_high_risk);
  });

  test('computes sensitivity, specificity, PPV and AUC', () => {
    const { patients } = getCohort();
    const cm = computeConfusionMatrix(patients);
    const metrics = metricsFromConfusion(cm);
    const { auc } = computeAUC(patients);
    assert.ok(cm.tp + cm.fp + cm.tn + cm.fn === cm.n);
    assert.ok(metrics.sensitivity >= 0 && metrics.sensitivity <= 1);
    assert.ok(metrics.specificity >= 0 && metrics.specificity <= 1);
    assert.ok(metrics.ppv >= 0 && metrics.ppv <= 1);
    assert.ok(auc >= 0.5 && auc <= 1);
  });

  test('full validation report includes outcome and diagnostic sections', () => {
    const report = runCohortValidation();
    assert.equal(report.engine, 'MedWear-CohortValidator-v1');
    assert.ok(report.outcomeValidation.earlyDiagnosisRate);
    assert.ok(report.outcomeValidation.treatmentInitiationDelay);
    assert.ok(report.outcomeValidation.survival5yImprovement);
    assert.ok(report.diagnosticValidation.metrics.auc != null);
    assert.ok(report.verdict.total >= 3);
    assert.equal(report.outcomeValidation.earlyDiagnosisRate.alignment.directionCorrect, true);
  });
});
