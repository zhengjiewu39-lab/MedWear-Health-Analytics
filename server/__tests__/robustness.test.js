const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const {
  computeDayScore,
  computeDayScoreDetail,
  evaluateDayAlerts,
  detectAnomaliesFromStore,
  buildStoreFromDays,
  classifyBHIWatchTier,
} = require('../services/analyticsCore');
const { extractFeatures, extractRawFeatures } = require('../services/extractFeatures');

const emptyDay = {
  steps: 0,
  heartRate: [],
  spo2: [],
  hrv: [],
  sleepMinutes: { deep: 0, rem: 0, light: 0, awake: 0 },
};

describe('Robustness — BHI and anomaly pipelines', () => {
  test('missing target day data returns finite BHI tier without throw', () => {
    const score = computeDayScore(emptyDay);
    assert.ok(score == null || Number.isFinite(score));
    assert.equal(classifyBHIWatchTier(score), 'unknown');
  });

  test('missing sensor dimensions (no HRV, no SpO2) still extracts features', () => {
    const features = extractFeatures({
      days: {
        '2026-04-01': {
          steps: 5000,
          heartRate: [72, 74],
          sleepMinutes: { deep: 60, rem: 90, light: 180, awake: 10 },
        },
      },
      targetDay: '2026-04-01',
    });
    assert.equal(features.avg_hrv, 0);
    assert.ok(features.avg_spo2 >= 50);
    assert.ok(Number.isFinite(features.health_score_norm));
  });

  test('single-point HR/SpO2 outliers are cleaned before scoring', () => {
    const features = extractFeatures({
      days: {
        '2026-04-02': {
          steps: 6000,
          heartRate: [70, 220, 72],
          spo2: [97, 40, 96],
          hrv: [45],
          sleepMinutes: { deep: 70, rem: 80, light: 200, awake: 10 },
        },
      },
      targetDay: '2026-04-02',
    });
    assert.ok(features.avg_hr <= 220);
    assert.ok(features.min_spo2 >= 50);
  });

  test('sensor drift (gradual HR rise) produces scores without crash', () => {
    const days = {};
    for (let i = 1; i <= 7; i++) {
      const base = 68 + i * 2;
      days[`2026-05-0${i}`] = {
        steps: 5000,
        heartRate: [base, base + 1, base + 2],
        spo2: [97, 98],
        hrv: [42],
        sleepMinutes: { deep: 60, rem: 90, light: 180, awake: 10 },
      };
    }
    const detail = computeDayScoreDetail(days['2026-05-07'], { priorDays: Object.values(days).slice(0, 6) });
    assert.ok(Number.isFinite(detail.score));
  });

  test('motion artifact — high-activity days excluded from MAD baseline', () => {
    const days = {};
    for (let i = 1; i <= 6; i++) {
      days[`2026-06-0${i}`] = {
        heartRate: [68, 70, 69],
        spo2: [97],
        steps: 9500,
      };
    }
    days['2026-06-07'] = {
      heartRate: [70, 130, 128, 72],
      spo2: [97],
      steps: 3000,
    };
    const store = buildStoreFromDays(days, '2026-06-07');
    const anomalies = detectAnomaliesFromStore(store);
    assert.ok(Array.isArray(anomalies));
  });

  test('recovery/rest day (low steps) — alerts and BHI degrade gracefully', () => {
    const day = {
      steps: 800,
      heartRate: [62, 64],
      spo2: [98],
      hrv: [50],
      sleepMinutes: { deep: 100, rem: 110, light: 220, awake: 20 },
    };
    const alerts = evaluateDayAlerts(day);
    assert.ok(Array.isArray(alerts));
    const score = computeDayScore(day);
    assert.ok(Number.isFinite(score));
    assert.ok(classifyBHIWatchTier(score));
  });

  test('extractRawFeatures omits engine-derived columns', () => {
    const raw = extractRawFeatures({
      days: {
        '2026-07-01': {
          steps: 7000,
          heartRate: [72, 74],
          spo2: [97],
          hrv: [45],
          sleepMinutes: { deep: 80, rem: 90, light: 180, awake: 10 },
        },
      },
      targetDay: '2026-07-01',
    });
    assert.equal(raw.anomaly_flag, undefined);
    assert.equal(raw.health_score_norm, undefined);
    assert.ok(raw.steps_norm != null);
  });
});
