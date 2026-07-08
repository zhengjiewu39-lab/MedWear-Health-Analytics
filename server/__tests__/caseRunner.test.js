/**
 * Unit tests for {@link module:public-health/caseRunner} — scenario loading and PHM pipeline.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  bootstrapFrameworkRecords,
  resolveIndividualRecords,
  scenarioTimeWindow,
  detectRegionalTrend,
  runScenarioPipeline,
  estimateSeverity,
  symptomSignals,
} = require('../public-health/caseRunner');
const { SYMPTOM_TYPES, SYNDROME_TYPES } = require('../public-health/constants');

const DATASET = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../benchmarks/public-health-dataset.json'), 'utf8'),
);

/** @param {string} id */
function findCase(id) {
  const scenario = DATASET.cases.find((c) => c.id === id);
  assert.ok(scenario, `expected scenario ${id} in dataset`);
  return scenario;
}

describe('caseRunner — estimateSeverity', () => {
  it('escalates severity when symptom and vitals are abnormal', () => {
    const severe = estimateSeverity({
      symptom: 'cough', hr: 85, steps: 3000, spo2: 94, temp_proxy: 37.5,
    });
    const mild = estimateSeverity({
      symptom: null, hr: 62, steps: 9000, spo2: 98, temp_proxy: 36.6,
    });
    assert.ok(severe > mild);
    assert.ok(severe <= 1);
  });
});

describe('caseRunner — symptomSignals', () => {
  it('maps benchmark symptom keys to canonical types', () => {
    const signals = symptomSignals('cough');
    assert.equal(signals.length, 1);
    assert.equal(signals[0].type, SYMPTOM_TYPES.COUGH);
    assert.equal(symptomSignals(null).length, 0);
  });
});

describe('caseRunner — bootstrapFrameworkRecords', () => {
  it('generates synthetic individuals for framework scenarios', () => {
    const scenario = findCase('PH-303');
    const records = bootstrapFrameworkRecords(scenario);
    assert.ok(records.length >= 3);
    assert.ok(records.every((r) => r._synthetic === true));
    assert.ok(records.every((r) => Object.keys(r.daily_timeseries).length >= 3));
  });

  it('uses exercise-like vitals for borderline false-positive bootstrap', () => {
    const scenario = findCase('PH-801');
    const records = bootstrapFrameworkRecords(scenario);
    const hrSpikeDay = records[0].daily_timeseries['2026-01-17'];
    assert.equal(hrSpikeDay.hr, 140);
    assert.equal(hrSpikeDay.symptom, null);
  });
});

describe('caseRunner — resolveIndividualRecords', () => {
  it('returns embedded records for complete scenarios', () => {
    const scenario = findCase('PH-301');
    const records = resolveIndividualRecords(scenario);
    assert.ok(records.length >= 5);
    assert.equal(records.some((r) => r._synthetic), false);
  });

  it('bootstraps records when individual_records is empty', () => {
    const scenario = findCase('PH-303');
    const records = resolveIndividualRecords(scenario);
    assert.ok(records.every((r) => r._synthetic));
  });
});

describe('caseRunner — scenarioTimeWindow', () => {
  it('anchors window end to last observation day in scenario data', () => {
    const scenario = findCase('PH-301');
    const records = resolveIndividualRecords(scenario);
    const tw = scenarioTimeWindow(records, 72);
    assert.equal(tw.anchor_day, '2026-01-18');
    assert.ok(new Date(tw.end).getTime() >= new Date(tw.start).getTime());
    assert.equal(tw.hours, 72);
  });

  it('includes January anomalies that would be excluded by wall-clock now', () => {
    const scenario = findCase('PH-301');
    const pipeline = runScenarioPipeline(scenario, 72);
    assert.ok(pipeline.level1.anomalies_recorded > 0, 'January data must fall inside anchored window');
  });
});

describe('caseRunner — detectRegionalTrend', () => {
  it('returns no alert for empty anomaly list', () => {
    const result = detectRegionalTrend([], { category: 'early_warning' });
    assert.equal(result.regional_trend_alert, false);
    assert.equal(result.unique_users, 0);
  });

  it('flags growth when recent counts exceed baseline threshold', () => {
    /** @type {import('../public-health/types').Anomaly[]} */
    const anomalies = [
      { userId: 'U1', observationDay: '2026-01-16', detectedAt: '2026-01-16T12:00:00.000Z', location: { geohash: 'wx4g0ab' } },
      { userId: 'U2', observationDay: '2026-01-17', detectedAt: '2026-01-17T12:00:00.000Z', location: { geohash: 'wx4g0cd' } },
      { userId: 'U3', observationDay: '2026-01-18', detectedAt: '2026-01-18T12:00:00.000Z', location: { geohash: 'wx4g0ef' } },
      { userId: 'U4', observationDay: '2026-01-18', detectedAt: '2026-01-18T14:00:00.000Z', location: { geohash: 'wx4g0gh' } },
      { userId: 'U5', observationDay: '2026-01-18', detectedAt: '2026-01-18T16:00:00.000Z', location: { geohash: 'wx4g0ij' } },
    ];
    const result = detectRegionalTrend(anomalies, { category: 'early_warning' });
    assert.equal(result.unique_users, 5);
    assert.ok(result.growth_ratio > 0);
  });
});

describe('caseRunner — runScenarioPipeline', () => {
  it('detects workplace cluster for complete case PH-301', () => {
    const scenario = findCase('PH-301');
    const pipeline = runScenarioPipeline(scenario, 72);

    assert.equal(pipeline.synthetic, false);
    assert.ok(pipeline.level1.individuals_with_anomalies >= 3);
    assert.equal(pipeline.level2.clusters_detected, 1);
    assert.ok(pipeline.level2.top_cluster);
    assert.equal(pipeline.level2.top_cluster.syndrome, SYNDROME_TYPES.RESPIRATORY);
  });

  it('does not false-alarm on borderline HR spike case PH-804', () => {
    const scenario = findCase('PH-804');
    const pipeline = runScenarioPipeline(scenario, 72);
    assert.equal(pipeline.level2.clusters_detected, 0);
  });

  it('detects cluster for framework scenario via synthetic bootstrap', () => {
    const scenario = findCase('PH-303');
    const pipeline = runScenarioPipeline(scenario, 72);
    assert.equal(pipeline.synthetic, true);
    assert.ok(pipeline.level2.clusters_detected >= 1);
  });
});
