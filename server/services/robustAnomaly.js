/**
 * Robust heuristic anomaly rules (MAD + activity context).
 * NOT a validated clinical detector — exploratory only.
 */

function avg(arr) {
  if (!arr?.length) return null;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function median(arr) {
  if (!arr?.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function mad(arr) {
  const m = median(arr);
  if (m == null) return 0;
  return median(arr.map((x) => Math.abs(x - m))) || 1e-6;
}

const DEFAULT_OPTS = {
  windowDays: 14,
  hrMadK: 2.5,
  spo2MadK: 2.0,
  minBaselineReadings: 10,
  activityStepsThreshold: 6500,
  hrSpikeMinCount: 3,
  spo2LowMinCount: 2,
};

const SENSITIVITY_PRESETS = {
  strict: { windowDays: 14, hrMadK: 3.0, spo2MadK: 2.5, activityStepsThreshold: 7000 },
  default: { ...DEFAULT_OPTS },
  sensitive: { windowDays: 7, hrMadK: 2.0, spo2MadK: 1.5, activityStepsThreshold: 5500 },
};

function detectRobustAnomalies(store, opts = {}) {
  const o = { ...DEFAULT_OPTS, ...opts };
  const days = Object.keys(store.daily || {}).sort().slice(-o.windowDays);
  const anomalies = [];

  const baselineHr = [];
  const baselineSpo2 = [];
  days.forEach((day) => {
    const d = store.daily[day];
    if ((d.steps || 0) < o.activityStepsThreshold) {
      baselineHr.push(...(d.heartRate || []));
    }
    baselineSpo2.push(...(d.spo2 || []));
  });

  if (baselineHr.length < o.minBaselineReadings) {
    return {
      anomalies: [],
      method: 'robust-mad-heuristic',
      disclaimer: 'Insufficient baseline readings — no anomaly call',
      opts: o,
    };
  }

  const hrMed = median(baselineHr);
  const hrScale = mad(baselineHr) * 1.4826;
  const spo2Med = median(baselineSpo2);
  const spo2Scale = Math.max(mad(baselineSpo2) * 1.4826, 0.35);

  days.forEach((day) => {
    const d = store.daily[day];
    const hrs = d.heartRate || [];
    const highActivity = (d.steps || 0) >= o.activityStepsThreshold;

    if (!highActivity && hrScale > 0) {
      const threshold = hrMed + o.hrMadK * hrScale;
      const spikes = hrs.filter((h) => h > threshold);
      if (spikes.length >= o.hrSpikeMinCount) {
        anomalies.push({
          type: '心率异常波动',
          day,
          rule: 'hr_mad_baseline',
          baselineMedian: Math.round(hrMed),
          threshold: Math.round(threshold),
          spikeCount: spikes.length,
          activityFiltered: true,
        });
      }
    }

    const spo2s = d.spo2 || [];
    const spo2Threshold = spo2Med - o.spo2MadK * spo2Scale;
    const low = spo2s.filter((s) => s < spo2Threshold);
    if (low.length >= o.spo2LowMinCount) {
      anomalies.push({
        type: '血氧偏低事件',
        day,
        rule: 'spo2_individual_mad',
        baselineMedian: +spo2Med.toFixed(1),
        threshold: +spo2Threshold.toFixed(1),
        lowCount: low.length,
      });
    }
  });

  return {
    anomalies,
    method: 'robust-mad-heuristic',
    disclaimer_en: 'Heuristic rule engine — not a validated clinical anomaly detector.',
    disclaimer_zh: '启发式规则引擎 — 非经临床验证的异常检测器。',
    opts: o,
    baseline: {
      hrMedian: Math.round(hrMed),
      hrMadScaled: +hrScale.toFixed(2),
      spo2Median: +spo2Med.toFixed(1),
      spo2MadScaled: +spo2Scale.toFixed(2),
    },
  };
}

function runSensitivityAnalysis(store) {
  return Object.entries(SENSITIVITY_PRESETS).map(([name, preset]) => {
    const r = detectRobustAnomalies(store, preset);
    return {
      preset: name,
      anomalyCount: r.anomalies.length,
      opts: preset,
    };
  });
}

module.exports = {
  detectRobustAnomalies,
  runSensitivityAnalysis,
  SENSITIVITY_PRESETS,
  median,
  mad,
};
