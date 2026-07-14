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

  test('real mode with imported data generates interventions without crash', () => {
    resetStore('real');
    const realData = {
      profile: { name: '测试用户', dayCount: 5, hasData: true },
      stats: { healthScore: 72, steps: 4200, restingHR: 78, spo2: 97 },
      dashboard: { stats: { healthScore: 72, steps: 4200, restingHR: 78, spo2: 97, heartRate: 75, hrv: 42, sleepHours: 6.5 } },
      diseaseScreening: {
        overallScore: 72,
        overallRisk: 'moderate',
        summary: 'test',
        dataCoverage: { quality: 85 },
        categories: [{
          name: '慢病',
          items: [{ name: '高血压', risk: 22, level: 'low', recommendation: '测血压' }],
        }],
      },
      anomalies: [],
      predictions: [{ id: 1, risk: '活动不足', probability: 35, level: 'medium', timeframe: '30天', recommendation: '多走路', factors: ['步数低'], model: 'MedWear-Predict-v2' }],
    };
    const result = generateInterventions({ patientId: 'real', realData });
    assert.ok(result.generated >= 1, 'should generate at least one intervention');
    assert.equal(result.patientId, 'real');
    assert.equal(result.patient.name, '测试用户');
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
