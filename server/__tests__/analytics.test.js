const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  computeDayScore,
  classifyRiskFromScore,
  evaluateDayAlerts,
  detectAnomaliesFromStore,
  buildStoreFromDays,
  evaluateCase,
} = require('../services/analyticsCore');

describe('health score', () => {
  test('scores healthy day above 75', () => {
    const score = computeDayScore({
      steps: 8500,
      heartRate: [68, 70],
      spo2: [97, 98],
      hrv: [50],
      restingHeartRate: 62,
      sleepMinutes: { deep: 90, rem: 100, light: 200, awake: 15 },
    });
    assert.ok(score >= 75);
  });

  test('classifies risk tiers', () => {
    assert.equal(classifyRiskFromScore(85), 'low');
    assert.equal(classifyRiskFromScore(70), 'moderate');
    assert.equal(classifyRiskFromScore(45), 'high');
  });
});

describe('alerts', () => {
  test('detects tachycardia', () => {
    const alerts = evaluateDayAlerts({ heartRate: [110, 112], steps: 5000, spo2: [97] });
    assert.ok(alerts.some(a => a.type === '心率偏高'));
  });

  test('detects hypoxemia', () => {
    const alerts = evaluateDayAlerts({ heartRate: [75], steps: 5000, spo2: [89, 90] });
    assert.ok(alerts.some(a => a.type === '血氧偏低'));
  });

  test('detects low activity', () => {
    const alerts = evaluateDayAlerts({ heartRate: [70], steps: 2000, spo2: [97] });
    assert.ok(alerts.some(a => a.type === '活动量不足'));
  });
});

describe('anomaly detection', () => {
  test('detects HR spikes beyond 2σ', () => {
    const days = {};
    for (let i = 1; i <= 7; i++) {
      const d = `2026-06-${String(i).padStart(2, '0')}`;
      days[d] = { heartRate: [68, 70, 69, 71], spo2: [97, 98], steps: 7000 };
    }
    days['2026-06-07'].heartRate = [70, 72, 130, 128, 132, 71, 73];
    const store = buildStoreFromDays(days, '2026-06-07');
    const anomalies = detectAnomaliesFromStore(store);
    assert.ok(anomalies.length > 0);
  });
});

describe('benchmark dataset integrity', () => {
  test('has labeled cases with valid structure', () => {
    const ds = require('../../benchmarks/wearable-analytics-dataset.json');
    assert.ok(ds.cases.length >= 8);
    ds.cases.forEach(c => {
      assert.ok(c.id && c.expected && c.days);
      assert.ok(['low', 'moderate', 'high'].includes(c.expected.riskLevel));
    });
  });
});

describe('evaluateCase', () => {
  test('WA-001 healthy baseline passes', () => {
    const ds = require('../../benchmarks/wearable-analytics-dataset.json');
    const c = ds.cases.find(x => x.id === 'WA-001');
    const result = evaluateCase(c, ds.thresholds);
    assert.equal(result.riskLevel, 'low');
    assert.equal(result.anomalyDetected, false);
    assert.deepEqual(result.alerts, []);
  });
});
