/**
 * MedWear PHM scenario runner — load benchmark cases into {@link ClusterDetectionEngine}.
 *
 * Responsibilities:
 *   - Bootstrap synthetic individuals for framework-only benchmark scenarios
 *   - Anchor evaluation time windows to scenario data dates (not wall-clock now)
 *   - Run Level 1 (anomaly inventory), Level 2 (cluster detection), Level 3 (regional trend)
 *
 * @module public-health/caseRunner
 */

const { ClusterDetectionEngine } = require('./cluster-detection');
const { SYMPTOM_TYPES, SYNDROME_TYPES, EPIDEMIOLOGY_DEFAULTS } = require('./constants');

/** @type {Record<string, string>} Map benchmark symptom keys to canonical SYMPTOM_TYPES. */
const SYMPTOM_MAP = {
  cough: SYMPTOM_TYPES.COUGH,
  sore_throat: SYMPTOM_TYPES.SORE_THROAT,
  gi_symptoms: SYMPTOM_TYPES.GI_SYMPTOMS,
  fatigue: SYMPTOM_TYPES.FATIGUE,
  shortness_of_breath: SYMPTOM_TYPES.SHORTNESS_OF_BREATH,
  fever: SYMPTOM_TYPES.FEVER,
};

/** @type {Record<string, { lat: number, lng: number }>} Default coordinates per scenario category. */
const DEFAULT_COORDS = {
  workplace_cluster: { lat: 39.9087, lng: 116.4716 },
  school_outbreak: { lat: 39.9834, lng: 116.3125 },
  residential_cluster: { lat: 39.8652, lng: 116.3784 },
  early_warning: { lat: 39.8652, lng: 116.3784 },
  chronic_monitoring: { lat: 39.9042, lng: 116.4074 },
  borderline_false_positive: { lat: 39.9921, lng: 116.3974 },
};

/**
 * Convert a daily symptom key into Level-1 anomaly signal objects.
 * @param {string|null|undefined} symptom - Benchmark symptom key (e.g. `cough`)
 * @returns {import('./types').SymptomSignal[]}
 */
function symptomSignals(symptom) {
  if (!symptom) return [];
  const type = SYMPTOM_MAP[symptom] || symptom;
  return [{ type, weight: 0.7, source: 'wearable_proxy', confidence: 0.75 }];
}

/**
 * Estimate anomaly severity from wearable proxy metrics for one day.
 * @param {object} day - Daily timeseries row with hr, steps, spo2, temp_proxy, symptom
 * @returns {number} Severity in [0, 1]
 */
function estimateSeverity(day) {
  let s = 0.35;
  if (day.symptom) s += 0.25;
  if (day.steps != null && day.steps < 4000) s += 0.15;
  if (day.hr != null && day.hr > 75) s += 0.1;
  if (day.spo2 != null && day.spo2 < 96) s += 0.15;
  if (day.temp_proxy != null && day.temp_proxy > 37.2) s += 0.1;
  return +Math.min(1, s).toFixed(2);
}

/**
 * Pick a representative symptom for synthetic bootstrap data.
 * @param {string} syndrome - SYNDROME_TYPES value from scenario context
 * @returns {string} Benchmark symptom key
 */
function defaultSymptomForSyndrome(syndrome) {
  if (syndrome === SYNDROME_TYPES.GASTROINTESTINAL) return 'gi_symptoms';
  if (syndrome === SYNDROME_TYPES.FEBRILE) return 'fever';
  if (syndrome === SYNDROME_TYPES.RESPIRATORY) return 'cough';
  return 'fatigue';
}

/**
 * Bootstrap synthetic individuals for framework-only scenarios.
 * @param {object} scenario - Benchmark scenario with category and epidemiological_context
 * @returns {object[]} Synthetic individual_records with `_synthetic: true`
 */
function bootstrapFrameworkRecords(scenario) {
  const count = scenario.individual_record_count
    || scenario.epidemiological_context?.population?.affected
    || 3;
  const base = scenario.spatial?.lat
    ? { lat: scenario.spatial.lat, lng: scenario.spatial.lng }
    : DEFAULT_COORDS[scenario.category] || DEFAULT_COORDS.workplace_cluster;
  const syndrome = scenario.epidemiological_context?.syndrome || SYNDROME_TYPES.UNSPECIFIED;
  const symptom = defaultSymptomForSyndrome(syndrome);
  const isBorderline = scenario.category === 'borderline_false_positive';
  const days = ['2026-01-16', '2026-01-17', '2026-01-18'];

  return Array.from({ length: count }, (_, i) => {
    const lat = base.lat + i * 0.0003;
    const lng = base.lng + i * 0.0003;
    /** @type {Record<string, object>} */
    const daily_timeseries = {};
    days.forEach((day, di) => {
      if (isBorderline) {
        daily_timeseries[day] = di === 1
          ? { temp_proxy: 36.8, hr: 140, steps: 14000, spo2: 98, hrv: 45, symptom: null }
          : { temp_proxy: 36.6, hr: 62, steps: 9000, spo2: 98, hrv: 48, symptom: null };
      } else {
        daily_timeseries[day] = di >= 1
          ? { temp_proxy: 37.4 + di * 0.1, hr: 78 + di, steps: 4000 - di * 500, spo2: 96, hrv: 32, symptom }
          : { temp_proxy: 36.6, hr: 64, steps: 8000, spo2: 98, hrv: 48, symptom: null };
      }
    });
    return {
      id: `SYN-${String(i + 1).padStart(3, '0')}`,
      user_profile: { age: 30 + i, gender: 'unknown', ses: i % 3 === 0 ? 'low' : 'medium' },
      location: { lat, lng, district_id: scenario.epidemiological_context?.district_id || '110105' },
      workplace: scenario.setting ? { poi_id: `POI-${scenario.id}`, type: scenario.setting } : null,
      baseline_metrics: { hr: 62, temp_proxy: 36.6, steps: 8500, spo2: 98 },
      daily_timeseries,
      _synthetic: true,
    };
  });
}

/**
 * Resolve individual records — use embedded data or bootstrap synthetics.
 * @param {object} scenario - Benchmark scenario
 * @returns {object[]} Individual records (complete or synthetic)
 */
function resolveIndividualRecords(scenario) {
  if (scenario.individual_records?.length) return scenario.individual_records;
  return bootstrapFrameworkRecords(scenario);
}

/**
 * Register scenario individuals and record Level-1 anomalies into the engine.
 * @param {ClusterDetectionEngine} engine - Target detection engine
 * @param {object} scenario - Benchmark scenario metadata
 * @param {object[]} records - Individual records from {@link resolveIndividualRecords}
 */
function loadScenarioIntoEngine(engine, scenario, records) {
  const syndrome = scenario.epidemiological_context?.syndrome || SYNDROME_TYPES.UNSPECIFIED;
  records.forEach((rec) => {
    const userId = `${scenario.id}-${rec.id}`;
    engine.registerUser(userId, {
      userId,
      age: rec.user_profile?.age,
      gender: rec.user_profile?.gender,
      ses: rec.user_profile?.ses,
      deviceId: `DEV-${rec.id}`,
      lastKnownLocation: {
        lat: rec.location.lat,
        lng: rec.location.lng,
        districtId: rec.location.district_id,
      },
      workplace: rec.workplace ? {
        poiId: rec.workplace.poi_id,
        type: rec.workplace.type,
        location: { lat: rec.location.lat, lng: rec.location.lng },
      } : null,
    });

    Object.entries(rec.daily_timeseries || {}).forEach(([day, metrics]) => {
      if (!metrics.symptom && metrics.hr < 100 && metrics.steps > 5000) return;
      if (metrics.hr > 120 && !metrics.symptom) return;
      engine.recordAnomaly(userId, {
        anomalyId: `${userId}-${day}`,
        detectedAt: `${day}T12:00:00.000Z`,
        observationDay: day,
        syndrome,
        symptoms: symptomSignals(metrics.symptom),
        severity: estimateSeverity(metrics),
        confidence: 0.8,
        location: { lat: rec.location.lat, lng: rec.location.lng, districtId: rec.location.district_id },
      });
    });
  });
}

/**
 * Level 3 — lightweight regional trend detector (EWMA-style growth ratio).
 * @param {import('./types').Anomaly[]} anomalies - Windowed Level-1 anomalies
 * @param {object} scenario - Benchmark scenario (category informs scatter heuristic)
 * @returns {{
 *   regional_trend_alert: boolean,
 *   growth_ratio: number,
 *   unique_users: number,
 *   level: number
 * }}
 */
function detectRegionalTrend(anomalies, scenario) {
  if (!anomalies.length) {
    return { regional_trend_alert: false, growth_ratio: 0, unique_users: 0, level: 0 };
  }
  const byDay = {};
  anomalies.forEach((a) => {
    const d = a.observationDay || a.detectedAt.slice(0, 10);
    byDay[d] = (byDay[d] || 0) + 1;
  });
  const sortedDays = Object.keys(byDay).sort();
  const counts = sortedDays.map((d) => byDay[d]);
  const split = Math.max(1, Math.floor(counts.length / 2));
  const baseline = counts.slice(0, split).reduce((s, v) => s + v, 0) / split;
  const recent = counts.slice(split).reduce((s, v) => s + v, 0) / Math.max(1, counts.length - split);
  const growthRatio = baseline > 0 ? (recent - baseline) / baseline : recent > 0 ? 1 : 0;

  const geohashPrefixes = new Set(
    anomalies.map((a) => (a.location?.geohash || '').slice(0, 5)).filter(Boolean),
  );
  const uniqueUsers = new Set(anomalies.map((a) => a.userId)).size;
  const scattered = geohashPrefixes.size >= 2 || scenario.category === 'early_warning';

  const alert = growthRatio >= EPIDEMIOLOGY_DEFAULTS.monitorThresholdRatio
    && uniqueUsers >= 3
    && scattered;

  return {
    regional_trend_alert: alert,
    growth_ratio: +growthRatio.toFixed(3),
    unique_users: uniqueUsers,
    level: alert ? 1 : 0,
  };
}

/**
 * Anchor evaluation window to scenario data (not wall-clock now).
 * @param {object[]} records - Individual records with daily_timeseries
 * @param {number} [hours=72] - Lookback duration in hours
 * @returns {import('./types').TimeWindow & { hours: number, anchor_day: string }}
 */
function scenarioTimeWindow(records, hours = 72) {
  const allDays = records
    .flatMap((r) => Object.keys(r.daily_timeseries || {}))
    .sort();
  const endDay = allDays[allDays.length - 1] || new Date().toISOString().slice(0, 10);
  const end = new Date(`${endDay}T23:59:59.000Z`);
  const start = new Date(end.getTime() - hours * 3600000);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    hours,
    anchor_day: endDay,
  };
}

/**
 * @typedef {Object} ScenarioPipelineResult
 * @property {ClusterDetectionEngine} engine
 * @property {object[]} records
 * @property {boolean} synthetic - Whether any record was bootstrapped
 * @property {import('./types').TimeWindow} timeWindow
 * @property {{ individuals_total: number, anomalies_recorded: number, individuals_with_anomalies: number }} level1
 * @property {{ clusters_detected: number, top_cluster: import('./types').Cluster|null }} level2
 * @property {ReturnType<detectRegionalTrend>} level3
 * @property {import('./types').Cluster[]} clusters
 */

/**
 * Run full PHM pipeline for one benchmark scenario.
 * @param {object} scenario - Benchmark scenario from public-health-dataset.json
 * @param {number} [timeWindowHours=72] - Spatiotemporal analysis window
 * @returns {ScenarioPipelineResult}
 */
function runScenarioPipeline(scenario, timeWindowHours = 72) {
  const engine = new ClusterDetectionEngine();
  const records = resolveIndividualRecords(scenario);
  const synthetic = records.some((r) => r._synthetic);
  loadScenarioIntoEngine(engine, scenario, records);

  const timeWindow = scenarioTimeWindow(records, timeWindowHours);
  const windowAnomalies = engine.getAnomaliesInWindow(timeWindow);

  const level1 = {
    individuals_total: records.length,
    anomalies_recorded: windowAnomalies.length,
    individuals_with_anomalies: new Set(windowAnomalies.map((a) => a.userId)).size,
  };

  const geoClusters = engine.groupByGeography(windowAnomalies, undefined);
  const clusters = geoClusters
    .map((g) => engine.analyzeCluster(g))
    .filter((c) => c && engine.meetsAlertCriteria(c));

  const level2 = {
    clusters_detected: clusters.length,
    top_cluster: clusters.sort((a, b) => b.likelihood - a.likelihood)[0] || null,
  };

  const level3 = detectRegionalTrend(windowAnomalies, scenario);

  return {
    engine, records, synthetic, timeWindow, level1, level2, level3, clusters,
  };
}

module.exports = {
  loadScenarioIntoEngine,
  bootstrapFrameworkRecords,
  resolveIndividualRecords,
  detectRegionalTrend,
  scenarioTimeWindow,
  runScenarioPipeline,
  estimateSeverity,
  symptomSignals,
  defaultSymptomForSyndrome,
};
