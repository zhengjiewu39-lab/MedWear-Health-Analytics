const { describe, test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  generateInterventions, getSummary, approveIntervention, rejectIntervention,
  getApprovedInterventions, resetStore,
} = require('../ai/interventionService');
const { getDemoPatientData } = require('../mock/demoPatientRegistry');

describe('AI intervention service', () => {
  beforeEach(() => {
    resetStore();
    generateInterventions();
  });

  test('real mode without imported data returns needsImport', () => {
    resetStore('real');
    const result = generateInterventions({ patientId: 'real', realData: null });
    assert.equal(result.generated, 0);
    assert.equal(result.needsImport, true);
    assert.deepEqual(result.interventions, []);
  });

  test('interventions are scoped to the selected patient only', () => {
    resetStore();
    const a = generateInterventions({ patientId: 'IV-0001', demoData: getDemoPatientData('IV-0001') });
    const b = generateInterventions({ patientId: 'UC-0150', demoData: getDemoPatientData('UC-0150') });
    assert.ok(a.generated >= 3);
    assert.ok(b.generated >= 3);
    assert.notEqual(a.patient.name, b.patient.name);
    assert.ok(a.interventions.every((it) => it.patientId === 'IV-0001'));
    assert.ok(b.interventions.every((it) => it.patientId === 'UC-0150'));
    const otherNameInA = b.patient.name;
    assert.ok(!a.interventions.some((it) => it.title.includes(otherNameInA) && it.source === 'cohort'));
  });

  test('generates interventions from AI signals', () => {
    const summary = getSummary();
    assert.ok(summary.total >= 5);
    assert.equal(summary.pending, summary.total);
    assert.equal(summary.governance.requiresApproval, true);
  });

  test('approve requires human action', () => {
    const summary = getSummary();
    const first = generateInterventions().interventions[0];
    const approved = approveIntervention(first.id, { user: 'admin', role: 'admin', note: '同意' });
    assert.equal(approved.status, 'approved');
    assert.equal(approved.reviewedBy, 'admin');
    assert.equal(getApprovedInterventions().length, 1);
    assert.equal(getSummary().pending, summary.pending - 1);
  });

  test('reject blocks execution', () => {
    const first = generateInterventions().interventions[0];
    const rejected = rejectIntervention(first.id, { user: 'admin', note: '观察' });
    assert.equal(rejected.status, 'rejected');
    assert.equal(getApprovedInterventions().length, 0);
  });
});
