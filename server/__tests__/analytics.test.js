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

const BHI_DEMO = { age: 42, sex: 'F' };

const FULL_DAY = {
  steps: 8000,
  restingHeartRate: 62,
  spo2: [97],
  hrv: [45],
  sleepMinutes: { deep: 60, rem: 60, light: 120, awake: 0 },
};

describe('behavioral health index', () => {
  test('BHI weights unchanged', () => {
    const { WEIGHTS } = require('../services/behavioralHealthIndex');
    assert.deepEqual(WEIGHTS, { steps: 0.28, sleep: 0.24, rhr: 0.20, spo2: 0.16, hrv: 0.12 });
  });

  test('sleepHours excludes awake from duration', () => {
    const { sleepHours } = require('../services/behavioralHealthIndex');
    const hours = sleepHours({ deep: 60, rem: 60, light: 120, awake: 480 });
    assert.equal(hours, 4);
  });

  test('SDNN reference uses age-adjusted formula', () => {
    const { sdnnReferenceMs, scoreHrv } = require('../services/behavioralHealthIndex');
    const age = 45;
    const ref = Math.max(28, 50 - 0.45 * Math.max(0, age - 30));
    assert.equal(sdnnReferenceMs(age), ref);
    assert.equal(scoreHrv(ref, age), 1);
  });

  test('missing RHR omits component — no ordinary HR mean fallback', () => {
    const { computeBehavioralHealthIndex } = require('../services/behavioralHealthIndex');
    const withRhr = computeBehavioralHealthIndex({
      steps: 8000,
      heartRate: [90, 95],
      restingHeartRate: 62,
      spo2: [97],
      hrv: [45],
      sleepMinutes: { deep: 60, rem: 60, light: 120, awake: 0 },
    }, { age: 42, sex: 'F' });
    const withoutRhr = computeBehavioralHealthIndex({
      steps: 8000,
      heartRate: [90, 95],
      spo2: [97],
      hrv: [45],
      sleepMinutes: { deep: 60, rem: 60, light: 120, awake: 0 },
    }, { age: 42, sex: 'F' });
    assert.ok(withRhr.missing.includes('rhr') === false);
    assert.ok(withoutRhr.missing.includes('rhr'));
    assert.notEqual(withRhr.score, withoutRhr.score);
  });

  test('resolveBhiDemographics returns null age/sex without fallback imputation', () => {
    const { resolveBhiDemographics } = require('../services/demographics');
    const d = resolveBhiDemographics({});
    assert.equal(d.age, null);
    assert.equal(d.sex, null);
    assert.equal(d.ageMissing, true);
    assert.equal(d.sexMissing, true);
    assert.equal(d.demographicsSource, 'missing');
    assert.equal(d.inferred, false);
    assert.equal(d.fallbackUsed, false);
  });

  describe('demographic missingness propagation', () => {
    test('Case 1: age + sex + RHR + SDNN present — RHR and HRV calculated', () => {
      const { computeBehavioralHealthIndex } = require('../services/behavioralHealthIndex');
      const detail = computeBehavioralHealthIndex(FULL_DAY, { age: 42, sex: 'F' });
      assert.ok(detail.components.rhr != null);
      assert.ok(detail.components.hrv != null);
      assert.equal(detail.unavailable.rhr, undefined);
      assert.equal(detail.unavailable.hrv, undefined);
    });

    test('Case 2: age present + sex missing — RHR unavailable, SDNN calculated, weights renormalized', () => {
      const { computeBehavioralHealthIndex } = require('../services/behavioralHealthIndex');
      const detail = computeBehavioralHealthIndex(FULL_DAY, { age: 42, sex: null });
      assert.equal(detail.unavailable.rhr, 'missing_sex');
      assert.ok(detail.components.hrv != null);
      assert.ok(detail.missing.includes('rhr'));
      assert.ok(detail.renormalized);
      assert.ok(detail.coverage < 1);
    });

    test('Case 3: age missing + sex present — RHR and SDNN unavailable, other components usable', () => {
      const { computeBehavioralHealthIndex } = require('../services/behavioralHealthIndex');
      const detail = computeBehavioralHealthIndex(FULL_DAY, { age: null, sex: 'M' });
      assert.equal(detail.unavailable.rhr, 'missing_age');
      assert.equal(detail.unavailable.hrv, 'missing_age');
      assert.ok(detail.components.steps != null);
      assert.ok(detail.components.spo2 != null);
      assert.ok(detail.score != null);
    });

    test('Case 4: age and sex missing — no demographic fallback, non-demographic components continue', () => {
      const { computeBehavioralHealthIndex } = require('../services/behavioralHealthIndex');
      const detail = computeBehavioralHealthIndex(FULL_DAY, {});
      assert.equal(detail.unavailable.rhr, 'missing_age_and_sex');
      assert.equal(detail.unavailable.hrv, 'missing_age');
      assert.ok(detail.components.steps != null);
      assert.ok(detail.components.sleep != null);
      assert.ok(detail.score != null);
    });

    test('Case 5: age and sex present but RHR missing — RHR unavailable (missing_rhr), no HR mean substitution', () => {
      const { computeBehavioralHealthIndex } = require('../services/behavioralHealthIndex');
      const detail = computeBehavioralHealthIndex({
        ...FULL_DAY,
        restingHeartRate: null,
        heartRate: [90, 95],
      }, { age: 42, sex: 'F' });
      assert.equal(detail.unavailable.rhr, 'missing_rhr');
      assert.ok(detail.components.hrv != null);
    });

    test('Case 6: age present, sex missing, SDNN present — SDNN still calculated', () => {
      const { computeBehavioralHealthIndex } = require('../services/behavioralHealthIndex');
      const detail = computeBehavioralHealthIndex(FULL_DAY, { age: 50, sex: null });
      assert.ok(detail.components.hrv != null);
      assert.equal(detail.unavailable.hrv, undefined);
    });

    test('regression: missing metadata never inject age=45 or sex=F into primary BHI path', () => {
      const { computeDayScoreDetail } = require('../services/analyticsCore');
      const { resolveBhiDemographics } = require('../services/demographics');
      const demo = resolveBhiDemographics({});
      assert.notEqual(demo.age, 45);
      assert.notEqual(demo.sex, 'F');
      const detail = computeDayScoreDetail(FULL_DAY, demo);
      assert.equal(detail.unavailable.rhr, 'missing_age_and_sex');
      assert.equal(detail.unavailable.hrv, 'missing_age');
      assert.equal(detail.components.rhr, undefined);
      assert.equal(detail.components.hrv, undefined);
    });
  });

  test('computeDayScore applies trend when >=3 prior days supplied', () => {
    const baseDay = {
      steps: 8500,
      heartRate: [68, 70],
      spo2: [97, 98],
      hrv: [50],
      restingHeartRate: 62,
      sleepMinutes: { deep: 90, rem: 100, light: 200, awake: 15 },
    };
    const lowPrior = { ...baseDay, steps: 2000, restingHeartRate: 78 };
    const scoreNoPrior = computeDayScore(baseDay, BHI_DEMO);
    const scoreWithPrior = computeDayScore(baseDay, {
      ...BHI_DEMO,
      priorDays: [lowPrior, lowPrior, lowPrior],
    });
    assert.notEqual(scoreNoPrior, scoreWithPrior);
  });

  test('trend adjustment clamped to ±3', () => {
    const { computeBHIWithTrend } = require('../services/behavioralHealthIndex');
    const day = {
      steps: 12000,
      heartRate: [65, 68],
      spo2: [98],
      hrv: [55],
      restingHeartRate: 58,
      sleepMinutes: { deep: 100, rem: 110, light: 220, awake: 10 },
    };
    const veryLowPrior = {
      steps: 500,
      heartRate: [95],
      spo2: [92],
      hrv: [20],
      restingHeartRate: 88,
      sleepMinutes: { deep: 30, rem: 30, light: 60, awake: 200 },
    };
    const detail = computeBHIWithTrend(day, [veryLowPrior, veryLowPrior, veryLowPrior], BHI_DEMO);
    assert.ok(detail.trendDelta >= -3 && detail.trendDelta <= 3);
  });

  test('healthy day scores above 75 (BHI)', () => {
    const score = computeDayScore({
      steps: 8500,
      heartRate: [68, 70],
      spo2: [97, 98],
      hrv: [50],
      restingHeartRate: 62,
      sleepMinutes: { deep: 90, rem: 100, light: 200, awake: 15 },
    }, BHI_DEMO);
    assert.ok(score >= 75);
  });

  test('BHI detail declares non-disease-risk kind', () => {
    const { computeDayScoreDetail } = require('../services/analyticsCore');
    const detail = computeDayScoreDetail({
      steps: 8500,
      heartRate: [68, 70],
      spo2: [97, 98],
      hrv: [50],
      restingHeartRate: 62,
      sleepMinutes: { deep: 90, rem: 100, light: 200, awake: 15 },
    }, BHI_DEMO);
    assert.equal(detail.kind, 'behavioral-health-index');
    assert.ok(detail.disclaimer_zh);
  });
});

describe('health score', () => {
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

  test('detects peak HR false positive pattern (wearable-style)', () => {
    const alerts = evaluateDayAlerts({ heartRate: [70, 72, 118, 71], steps: 9000, spo2: [97] });
    assert.ok(alerts.some(a => a.type === '心率偏高'));
  });

  test('detects single low SpO2 reading', () => {
    const alerts = evaluateDayAlerts({ heartRate: [75], steps: 5000, spo2: [97, 96, 89, 98] });
    assert.ok(alerts.some(a => a.type === '血氧偏低'));
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
  test('detects HR spikes beyond robust MAD baseline', () => {
    const days = {};
    for (let i = 1; i <= 7; i++) {
      const d = `2026-06-${String(i).padStart(2, '0')}`;
      days[d] = { heartRate: [68, 70, 69, 71], spo2: [97, 98], steps: 4000 };
    }
    days['2026-06-07'] = {
      heartRate: [70, 72, 130, 128, 132, 71, 73],
      spo2: [97, 98],
      steps: 5000,
    };
    const store = buildStoreFromDays(days, '2026-06-07');
    const anomalies = detectAnomaliesFromStore(store);
    assert.ok(anomalies.length > 0);
  });
});

describe('benchmark dataset integrity', () => {
  test('has labeled cases with valid structure', () => {
    const ds = require('../../benchmarks/wearable-analytics-dataset.json');
    assert.ok(ds.cases.length >= 100, `expected n≥100 for clinical estimation, got ${ds.cases.length}`);
    assert.ok(ds.n >= 100 || ds.cases.length >= 100);
    assert.ok(
      ['independent-synthetic-reference-v1', 'independent-reference-v1'].includes(ds.labelSource),
      'expected independent synthetic reference label source',
    );
    assert.ok(ds.clinicalCharacteristics?.targetDayVitals, 'expected clinical cohort summary');
    assert.ok(ds.physiologyMix?.clinicalRandom != null, 'expected random physiology mix');
    ds.cases.forEach(c => {
      assert.ok(c.id && c.expected && c.days);
      assert.ok(['low', 'moderate', 'high'].includes(c.expected.riskLevel));
    });
  });

  test('benchmark seed remains 42 and n=5000', () => {
    const ds = require('../../benchmarks/wearable-analytics-dataset.json');
    assert.equal(ds.seed, 42);
    assert.equal(ds.n, 5000);
    assert.equal(ds.dataset, 'MedWear-Wearable-Analytics-Benchmark-v3');
  });

  test('evaluation metrics are not circular self-test (all ≥98%)', () => {
    const { run } = require('../../scripts/evaluate-analytics');
    const results = run();
    assert.equal(results.integrity, 'independent-reference');
    assert.ok(!results.circularLabelWarning);
    assert.ok(results.metrics.anomalyAccuracy < 0.98);
    assert.ok(results.metrics.alerts.precision < 1, 'expected realistic alert false positives');
    assert.ok(results.metrics.riskAccuracy < 0.98);
  });
});

describe('evaluateCase', () => {
  test('WA-001 runs through analytics engine', () => {
    const ds = require('../../benchmarks/wearable-analytics-dataset.json');
    const c = ds.cases.find(x => x.id === 'WA-001');
    const result = evaluateCase(c, ds.thresholds);
    assert.ok(result.healthScore != null);
    assert.ok(['low', 'moderate', 'high'].includes(result.riskLevel));
    assert.ok(Array.isArray(result.alerts));
  });
});
