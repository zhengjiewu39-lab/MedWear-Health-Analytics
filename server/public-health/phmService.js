/**
 * MedWear PHM runtime service — in-memory state, demo seed, cluster refresh.
 */

const path = require('path');
const { ClusterDetectionEngine } = require('./cluster-detection');
const { PublicHealthReporting } = require('./reporting');
const { SYMPTOM_TYPES, SYNDROME_TYPES, PHM_ENGINE_VERSION } = require('./constants');

/** @type {Record<string, { district_id: string, district_name: string, total_population: number }>} */
const DISTRICT_ALIASES = {
  pudong: { district_id: '310115', district_name: '浦东新区', total_population: 5800000 },
  chaoyang: { district_id: '110105', district_name: '朝阳区', total_population: 3450000 },
  dongcheng: { district_id: '110101', district_name: '东城区', total_population: 708000 },
  haidian: { district_id: '110108', district_name: '海淀区', total_population: 3320000 },
  tongzhou: { district_id: '110112', district_name: '通州区', total_population: 1840000 },
};

const SYMPTOM_MAP = {
  cough: SYMPTOM_TYPES.COUGH,
  sore_throat: SYMPTOM_TYPES.SORE_THROAT,
  gi_symptoms: SYMPTOM_TYPES.GI_SYMPTOMS,
  fatigue: SYMPTOM_TYPES.FATIGUE,
  shortness_of_breath: SYMPTOM_TYPES.SHORTNESS_OF_BREATH,
  fever: SYMPTOM_TYPES.FEVER,
};

/** @param {string} raw */
function resolveDistrict(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const key = raw.trim().toLowerCase();
  if (DISTRICT_ALIASES[key]) return { ...DISTRICT_ALIASES[key], alias: key };
  if (/^\d{6}$/.test(key)) {
    const found = Object.values(DISTRICT_ALIASES).find((d) => d.district_id === key);
    return found ? { ...found, alias: key } : { district_id: key, district_name: key, total_population: 500000, alias: key };
  }
  return { district_id: key, district_name: raw, total_population: 500000, alias: key };
}

/** @param {string} date */
function isValidDate(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00.000Z`));
}

function symptomToSignals(symptom) {
  if (!symptom) return [];
  const type = SYMPTOM_MAP[symptom] || symptom;
  return [{ type, weight: 0.7, source: 'wearable_proxy', confidence: 0.75 }];
}

function estimateSeverity(day) {
  let s = 0.35;
  if (day.symptom) s += 0.25;
  if (day.steps != null && day.steps < 4000) s += 0.15;
  if (day.hr != null && day.hr > 75) s += 0.1;
  if (day.spo2 != null && day.spo2 < 96) s += 0.15;
  if (day.temp_proxy != null && day.temp_proxy > 37.2) s += 0.1;
  return +Math.min(1, s).toFixed(2);
}

class PhmService {
  constructor() {
    /** @type {ClusterDetectionEngine} */
    this.engine = new ClusterDetectionEngine();
    /** @type {DetectedCluster[]} */
    this.clusters = [];
    /** @type {import('./types').PublicHealthAlert[]} */
    this.alerts = [];
    this.reporting = new PublicHealthReporting();
    this._seedDemo();
    this.refreshClusters(72);
  }

  /** Load complete benchmark scenarios into the engine. */
  _seedDemo() {
    try {
      const dataset = require(path.join(__dirname, '../../benchmarks/public-health-dataset.json'));
      const caseDistrict = {
        'PH-301': '110105',
        'PH-302': '310115',
        'PH-401': '110108',
        'PH-601': '110106',
        'PH-804': '110108',
      };
      dataset.cases
        .filter((c) => c.schema_level === 'complete')
        .forEach((scenario) => {
          const districtId = caseDistrict[scenario.id] || scenario.epidemiological_context?.district_id;
          (scenario.individual_records || []).forEach((rec) => {
            const userId = `${scenario.id}-${rec.id}`;
            this.engine.registerUser(userId, {
              userId,
              age: rec.user_profile?.age,
              gender: rec.user_profile?.gender,
              ses: rec.user_profile?.ses,
              deviceId: `DEV-${rec.id}`,
              lastKnownLocation: {
                lat: rec.location.lat,
                lng: rec.location.lng,
                districtId,
                source: 'grid',
              },
              workplace: rec.workplace ? {
                poiId: rec.workplace.poi_id,
                type: rec.workplace.type,
                location: { lat: rec.location.lat, lng: rec.location.lng, districtId },
              } : null,
            });
            Object.entries(rec.daily_timeseries || {}).forEach(([day, metrics]) => {
              if (!metrics.symptom && metrics.hr < 100 && metrics.steps > 5000) return;
              if (metrics.hr > 120 && !metrics.symptom) return;
              this.engine.recordAnomaly(userId, {
                anomalyId: `${userId}-${day}`,
                detectedAt: `${day}T12:00:00.000Z`,
                observationDay: day,
                syndrome: scenario.epidemiological_context?.syndrome || SYNDROME_TYPES.UNSPECIFIED,
                symptoms: symptomToSignals(metrics.symptom),
                severity: estimateSeverity(metrics),
                confidence: 0.8,
                location: { lat: rec.location.lat, lng: rec.location.lng, districtId },
              });
            });
          });
        });
    } catch (e) {
      console.warn('[PHM] Demo seed skipped:', e.message);
    }
    this._syncReportingState();
  }

  _syncReportingState() {
    const districts = {};
    Object.entries(DISTRICT_ALIASES).forEach(([, v]) => {
      districts[v.district_id] = {
        district_id: v.district_id,
        district_name: v.district_name,
        total_population: v.total_population,
      };
    });
    this.reporting.setData({
      users: [...this.engine.users.values()],
      anomalies: this.engine.anomalies,
      clusters: this.clusters,
      alerts: this.alerts,
      districts,
    });
  }

  /**
   * Anchor detection window to latest benchmark anomaly in scope (not wall-clock now).
   * @param {number} hours
   * @param {string} [districtId]
   * @returns {{ start: string, end: string, hours: number, anchor_day: string }}
   */
  _anchoredTimeWindow(hours = 72, districtId = null) {
    let pool = this.engine.anomalies.filter((a) => /^PH-\d{3}-/.test(a.userId));
    if (districtId) {
      const userIds = new Set(this._usersForDistrict(districtId).map((u) => u.userId));
      pool = pool.filter((a) => userIds.has(a.userId));
    }
    if (!pool.length) pool = this.engine.anomalies;
    const allDays = pool
      .map((a) => a.observationDay || a.detectedAt.slice(0, 10))
      .sort();
    const endDay = allDays[allDays.length - 1] || '2026-01-18';
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
   * Re-run cluster detection and rebuild alert stubs.
   * @param {number} [timeWindowHours]
   * @param {string} [districtId] - optional district scope
   */
  refreshClusters(timeWindowHours = 72, districtId = null) {
    const tw = this._anchoredTimeWindow(timeWindowHours, districtId);
    let anomalies = this.engine.getAnomaliesInWindow(tw);
    if (districtId) {
      const userIds = new Set(this._usersForDistrict(districtId).map((u) => u.userId));
      anomalies = anomalies.filter((a) => userIds.has(a.userId));
    }
    const geoClusters = this.engine.groupByGeography(anomalies, undefined);
    this.clusters = geoClusters
      .map((g) => this.engine.analyzeCluster(g))
      .filter((c) => c && this.engine.meetsAlertCriteria(c))
      .sort((a, b) => b.likelihood - a.likelihood);
    this.alerts = this.clusters.map((c) => ({
      alertId: `AL-${c.clusterId}`,
      type: 'cluster',
      level: c.alertCriteria?.level ?? 1,
      levelLabel: c.alertCriteria?.levelLabel ?? 'MONITOR',
      severity: c.severity,
      syndrome: c.syndrome,
      regionId: c.centroid?.districtId || '110105',
      title: `聚集点预警 ${c.clusterId}`,
      summary: `${c.memberCount} 人 ${c.syndrome} 相关信号聚集，可能性 ${(c.likelihood * 100).toFixed(0)}%`,
      clusterIds: [c.clusterId],
      actions: [],
      stakeholders: [],
      confidence: c.likelihood,
      issuedAt: c.detectedAt || new Date().toISOString(),
      status: 'active',
    }));
    this._syncReportingState();
    return this.clusters;
  }

  /** @param {string} districtRaw @param {string} date */
  getSummary(districtRaw, date) {
    const district = resolveDistrict(districtRaw);
    if (!district) throw new Error('INVALID_DISTRICT');
    if (!isValidDate(date)) throw new Error('INVALID_DATE');

    this.refreshClusters(72, district.district_id);
    const users = this._usersForDistrict(district.district_id);
    const anomalies = this._anomaliesForDistrict(district.district_id, date);
    const clusters = this._clustersForDistrict(district.district_id);
    const alerts = this.alerts.filter((a) => a.regionId === district.district_id);

    return {
      report_date: date,
      district_id: district.district_id,
      district_name: district.district_name,
      district_alias: district.alias,
      engine_version: PHM_ENGINE_VERSION,
      narrative_summary: `${date} ${district.district_name} 社区监测概况：`
        + `在册 ${users.length} 人，当日异常 ${anomalies.length} 条，`
        + `活跃聚集点 ${clusters.length} 处，预警 ${alerts.length} 条。`,
      monitoring_overview: {
        total_monitored_population: users.length,
        total_population_denominator: district.total_population,
        device_coverage: district.total_population > 0
          ? +(users.length / district.total_population).toFixed(6) : 0,
        devices_active_today: users.filter((u) => u.deviceId).length,
        anomalies_today: anomalies.length,
        active_clusters: clusters.length,
        active_alerts: alerts.length,
      },
      anomalies_by_syndrome: this._countField(anomalies, 'syndrome'),
      top_clusters: clusters.slice(0, 5).map((c) => ({
        cluster_id: c.clusterId,
        member_count: c.memberCount,
        syndrome: c.syndrome,
        likelihood: c.likelihood,
        severity: c.severity,
      })),
    };
  }

  /** @param {string} districtRaw @param {number} timeWindowHours */
  getClusters(districtRaw, timeWindowHours) {
    const district = resolveDistrict(districtRaw);
    if (!district) throw new Error('INVALID_DISTRICT');
    if (!Number.isFinite(timeWindowHours) || timeWindowHours <= 0 || timeWindowHours > 720) {
      throw new Error('INVALID_TIME_WINDOW');
    }
    this.refreshClusters(timeWindowHours, district.district_id);
    const clusters = this.clusters;
    return {
      district_id: district.district_id,
      district_name: district.district_name,
      time_window_hours: timeWindowHours,
      cluster_count: clusters.length,
      clusters: clusters.map((c) => ({
        cluster_id: c.clusterId,
        member_count: c.memberCount,
        syndrome: c.syndrome,
        severity: c.severity,
        outbreak_likelihood: c.likelihood,
        centroid: c.centroid,
        radius_meters: c.radiusMeters,
        detected_at: c.detectedAt,
        alert_level: c.alertCriteria?.levelLabel,
        epi_profile: c.epiProfile,
      })),
    };
  }

  /** @param {string} districtRaw @param {string} date */
  getDailyReport(districtRaw, date) {
    const district = resolveDistrict(districtRaw);
    if (!district) throw new Error('INVALID_DISTRICT');
    if (!isValidDate(date)) throw new Error('INVALID_DATE');
    this.refreshClusters(72, district.district_id);
    return this.reporting.generateDailyReport(date, district.district_id);
  }

  /** @param {string} clusterId */
  getInvestigationReport(clusterId) {
    if (!clusterId || typeof clusterId !== 'string') throw new Error('INVALID_CLUSTER_ID');
    return this.reporting.generateInvestigationReport(clusterId.trim());
  }

  /** @param {string} districtRaw @param {string} date */
  getEquityReport(districtRaw, date) {
    const district = resolveDistrict(districtRaw);
    if (!district) throw new Error('INVALID_DISTRICT');
    if (!isValidDate(date)) throw new Error('INVALID_DATE');
    return this.reporting.generateEquityAnalysisReport(date, district.district_id);
  }

  /**
   * @param {object} body
   * @returns {import('./types').User | null}
   */
  registerUser(body) {
    const userId = String(body.userId || '').trim();
    if (!userId) throw new Error('MISSING_USER_ID');

    const coords = body.coordinates || body.location;
    if (!coords || typeof coords.lat !== 'number' || typeof coords.lng !== 'number') {
      throw new Error('INVALID_COORDINATES');
    }

    const ses = body.ses;
    if (ses && !['low', 'medium', 'high', 'unknown'].includes(ses)) {
      throw new Error('INVALID_SES');
    }

    const age = body.age != null ? Number(body.age) : undefined;
    if (age != null && (Number.isNaN(age) || age < 0 || age > 120)) {
      throw new Error('INVALID_AGE');
    }

    const districtId = body.district_id || body.districtId;
    const user = this.engine.registerUser(userId, {
      userId,
      age,
      ses: ses || 'unknown',
      gender: body.gender || 'unknown',
      deviceId: body.deviceId || `DEV-${userId}`,
      lastKnownLocation: {
        lat: coords.lat,
        lng: coords.lng,
        districtId: districtId || undefined,
        source: 'manual',
      },
      workplace: body.workplace || null,
      riskFactors: body.riskFactors || body.risk_factors || [],
    });

    this._syncReportingState();
    return user;
  }

  /** @param {string} districtId */
  _usersForDistrict(districtId) {
    return [...this.engine.users.values()].filter((u) =>
      u.lastKnownLocation?.districtId === districtId
      || u.homeLocation?.districtId === districtId
      || u.workplace?.location?.districtId === districtId,
    );
  }

  /** @param {string} districtId @param {string} [date] */
  _anomaliesForDistrict(districtId, date) {
    return this.engine.anomalies.filter((a) => {
      const matchDistrict = a.location?.districtId === districtId;
      if (!date) return matchDistrict;
      const day = a.observationDay || a.detectedAt.slice(0, 10);
      return matchDistrict && day === date;
    });
  }

  /** @param {string} districtId */
  _clustersForDistrict(districtId) {
    const userIds = new Set(this._usersForDistrict(districtId).map((u) => u.userId));
    return this.clusters.filter((c) =>
      c.members.some((memberId) => {
        const anomaly = this.engine.anomalies.find((a) => a.anomalyId === memberId);
        return anomaly && userIds.has(anomaly.userId);
      }),
    );
  }

  /** @param {object[]} items @param {string} field */
  _countField(items, field) {
    /** @type {Record<string, number>} */
    const counts = {};
    items.forEach((item) => {
      const k = item[field] || 'unknown';
      counts[k] = (counts[k] || 0) + 1;
    });
    return counts;
  }
}

let singleton = null;

function getPhmService() {
  if (!singleton) singleton = new PhmService();
  return singleton;
}

module.exports = {
  PhmService,
  getPhmService,
  resolveDistrict,
  isValidDate,
  DISTRICT_ALIASES,
};
