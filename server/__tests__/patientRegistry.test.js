const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { getPatientRecords, getAdminOverview } = require('../screening/patientRegistry');
const { DEFAULT_N, getCohort } = require('../screening/outcomeModel');
const { verifyUniqueNames } = require('../data/patientIdentity');

describe('patient registry', () => {
  test('derives patient records from cohort with realistic vitals', () => {
    const records = getPatientRecords();
    assert.equal(records.length, DEFAULT_N);
    const p = records[0];
    assert.ok(p.id);
    assert.ok(p.name);
    assert.ok(['男', '女'].includes(p.gender));
    assert.ok(p.age >= 40 && p.age <= 82);
    assert.ok(p.signals.restingHR >= 45 && p.signals.restingHR <= 120);
    assert.ok(p.signals.spo2 >= 85 && p.signals.spo2 <= 100);
    assert.ok(p.healthScore >= 38 && p.healthScore <= 99);
    assert.ok(p.deviceIntegration);
    assert.ok(p.deviceIntegration.fusionAccuracy > p.deviceIntegration.singleDeviceAccuracy);
  });

  test('all 5000 cohort members have unique names', () => {
    const { patients } = getCohort();
    const result = verifyUniqueNames(patients);
    assert.equal(result.ok, true, result.duplicate ? `duplicate name: ${result.duplicate} at ${result.id}` : '');
    assert.equal(result.count, DEFAULT_N);
  });

  test('patients receive distinct multi-device stacks', () => {
    const records = getPatientRecords();
    const stacks = new Set(records.slice(0, 200).map((p) =>
      (p.deviceList || []).map((d) => d.deviceId).sort().join('|')));
    assert.ok(stacks.size > 20);
    assert.ok(records.every((p) => p.devices >= 2 && p.devices <= 4));
  });

  test('admin overview reflects cohort size', () => {
    const overview = getAdminOverview();
    assert.equal(overview.patientCount, DEFAULT_N);
    assert.equal(overview.interventionCount + overview.controlCount, DEFAULT_N);
  });
});
