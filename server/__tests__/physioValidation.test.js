const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const {
  cleanHeartRate,
  cleanSpo2,
  cleanDayData,
  validateFeatureVector,
  PHYSIO_LIMITS,
} = require('../services/physioValidation');

describe('physioValidation', () => {
  test('replaces SpO2 below 50% with median imputation', () => {
    const { clean, artifacts } = cleanSpo2([97, 98, 42, 96]);
    assert.equal(artifacts.length, 1);
    assert.ok(clean.every((v) => v >= PHYSIO_LIMITS.spo2Min));
  });

  test('replaces HR above 220 with median imputation', () => {
    const { clean, artifacts } = cleanHeartRate([72, 74, 230, 73]);
    assert.equal(artifacts.length, 1);
    assert.ok(clean.every((v) => v <= PHYSIO_LIMITS.hrMax));
  });

  test('validates 17-dim feature vector schema', () => {
    const features = validateFeatureVector({
      steps_norm: 0.8,
      avg_hr: 72,
      std_hr: 3,
      resting_hr: 65,
      avg_spo2: 97,
      min_spo2: 96,
      avg_hrv: 45,
      sleep_hours: 7,
      deep_sleep_ratio: 0.2,
      active_energy_norm: 0.6,
      hr_above_threshold: 0,
      spo2_below_threshold: 0,
      low_activity: 0,
      window_hr_mean: 70,
      window_hr_std: 4,
      anomaly_flag: 0,
      health_score_norm: 0.85,
    });
    assert.equal(features.avg_hr, 72);
  });

  test('cleanDayData produces valid day schema', () => {
    const { day, cleaningReport } = cleanDayData({
      steps: 8000,
      heartRate: [72, 250, 74],
      spo2: [97, 40, 96],
      hrv: [45],
      sleepMinutes: { deep: 60, rem: 90, light: 200, awake: 10 },
    });
    assert.ok(day.steps === 8000);
    assert.ok(cleaningReport.heartRate.artifacts >= 1);
    assert.ok(cleaningReport.spo2.artifacts >= 1);
  });
});
