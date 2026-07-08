/**
 * MedWear PHM Level-2 — spatiotemporal community cluster detection.
 *
 * Pipeline (see {@link ClusterDetectionEngine#detectCommunityCluster}):
 *   1. getAnomaliesInWindow  — collect Level-1 events in 72h window
 *   2. groupByGeography      — Geohash binning + radius merge (500m)
 *   3. analyzeCluster        — epidemiological profile + outbreak likelihood
 *   4. meetsAlertCriteria    — filter clusters meeting MONITOR+ threshold
 */

const crypto = require('crypto');
const { haversineKm } = require('../geo/location');
const { defineType, EMPTY_ANOMALY } = require('./types');
const {
  CLUSTER_THRESHOLDS,
  ALERT_LEVELS,
  ALERT_LEVEL_LABELS,
  SYNDROME_TYPES,
  EPIDEMIOLOGY_DEFAULTS,
  CLUSTER_SEVERITY_THRESHOLDS,
  PHM_ENGINE_VERSION,
} = require('./constants');

const GEOHASH_BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/**
 * @typedef {Object} ClusterEpiProfile
 * @property {number} symptomConcordance - 0–1 symptom/syndrome alignment within cluster
 * @property {string} dominantSyndrome - Most frequent syndrome bucket
 * @property {string[]} dominantSymptoms - Top contributing symptom proxies
 * @property {Record<string, number>} symptomCounts - Symptom type → count
 * @property {Record<string, number>} ageBandDistribution - Age band → count
 * @property {Record<string, number>} workplaceTypes - Workplace type → count
 * @property {number} vulnerabilityRate - Fraction elderly / high-risk / low SES
 * @property {number} meanSeverity - Mean anomaly severity 0–1
 * @property {number} meanConfidence - Mean detector confidence 0–1
 * @property {number} temporalSpanHours - Hours between first and last event
 */

/**
 * @typedef {import('./types').Cluster & {
 *   epiProfile: ClusterEpiProfile,
 *   alertCriteria?: AlertCriteriaResult,
 * }} DetectedCluster
 */

/**
 * @typedef {Object} AlertCriteriaResult
 * @property {boolean} met - Whether cluster meets minimum alert threshold
 * @property {number} level - ALERT_LEVELS numeric tier (0 = none)
 * @property {string} levelLabel - MONITOR | ALERT | ACTION | NONE
 * @property {string[]} reasons - Machine-readable trigger reasons
 */

/**
 * Intermediate geographic grouping before epidemiological analysis.
 * @typedef {Object} GeoCluster
 * @property {import('./types').Anomaly[]} anomalies - All anomalies in spatial group
 * @property {string[]} geohashKeys - Contributing geohash cell ids
 * @property {import('./types').TimeWindow} timeWindow - Analysis time window
 * @property {number} geoRadiusMeters - Spatial merge radius used
 */

/**
 * Encode WGS-84 coordinates to geohash string.
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} [precision] - Geohash length (default from CLUSTER_THRESHOLDS)
 * @returns {string}
 */
function encodeGeohash(lat, lng, precision = CLUSTER_THRESHOLDS.geohashPrecision) {
  let idx = 0;
  let bit = 0;
  let even = true;
  let hash = '';
  let latMin = -90;
  let latMax = 90;
  let lngMin = -180;
  let lngMax = 180;

  while (hash.length < precision) {
    if (even) {
      const mid = (lngMin + lngMax) / 2;
      if (lng >= mid) { idx = idx * 2 + 1; lngMin = mid; }
      else { idx *= 2; lngMax = mid; }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) { idx = idx * 2 + 1; latMin = mid; }
      else { idx *= 2; latMax = mid; }
    }
    even = !even;
    if (++bit === 5) {
      hash += GEOHASH_BASE32[idx];
      bit = 0;
      idx = 0;
    }
  }
  return hash;
}

/**
 * Decode geohash to approximate cell center.
 * @param {string} hash
 * @returns {{ lat: number, lng: number, latErr: number, lngErr: number } | null}
 */
function decodeGeohash(hash) {
  if (!hash) return null;
  let even = true;
  let latMin = -90;
  let latMax = 90;
  let lngMin = -180;
  let lngMax = 180;

  for (const c of hash) {
    const idx = GEOHASH_BASE32.indexOf(c);
    if (idx < 0) return null;
    for (let bit = 4; bit >= 0; bit -= 1) {
      const mask = 1 << bit;
      if (even) {
        const mid = (lngMin + lngMax) / 2;
        if (idx & mask) lngMin = mid;
        else lngMax = mid;
      } else {
        const mid = (latMin + latMax) / 2;
        if (idx & mask) latMin = mid;
        else latMax = mid;
      }
      even = !even;
    }
  }
  return {
    lat: (latMin + latMax) / 2,
    lng: (lngMin + lngMax) / 2,
    latErr: (latMax - latMin) / 2,
    lngErr: (lngMax - lngMin) / 2,
  };
}

/**
 * Return geohash cell plus eight neighbors (for spatial expansion).
 * @param {string} hash
 * @returns {Set<string>}
 */
function expandGeohashNeighborhood(hash) {
  const neighbors = new Set([hash]);
  const center = decodeGeohash(hash);
  if (!center) return neighbors;

  const { lat, lng, latErr, lngErr } = center;
  const offsets = [
    [latErr * 2, 0], [-latErr * 2, 0], [0, lngErr * 2], [0, -lngErr * 2],
    [latErr * 2, lngErr * 2], [latErr * 2, -lngErr * 2],
    [-latErr * 2, lngErr * 2], [-latErr * 2, -lngErr * 2],
  ];
  offsets.forEach(([dLat, dLng]) => {
    neighbors.add(encodeGeohash(lat + dLat, lng + dLng, hash.length));
  });
  return neighbors;
}

/** @param {number} n @returns {number} */
function clamp01(n) {
  return Math.min(1, Math.max(0, n));
}

/** @param {number[]} nums @returns {number} */
function avg(nums) {
  if (!nums?.length) return 0;
  return nums.reduce((s, v) => s + v, 0) / nums.length;
}

/** @param {string[]} arr @returns {string[]} */
function unique(arr) {
  return [...new Set(arr)];
}

/**
 * Map age to surveillance band for aggregate reporting.
 * @param {number | undefined} age
 * @returns {string}
 */
function ageBand(age) {
  if (age == null || Number.isNaN(age)) return 'unknown';
  if (age < 18) return '0-17';
  if (age < 36) return '18-35';
  if (age < 61) return '36-60';
  return '61+';
}

/**
 * Level-2 engine: detect community clusters from registered users and anomalies.
 */
class ClusterDetectionEngine {
  /**
   * @param {Partial<typeof CLUSTER_THRESHOLDS & typeof EPIDEMIOLOGY_DEFAULTS>} [options]
   */
  constructor(options = {}) {
    this.thresholds = { ...CLUSTER_THRESHOLDS, ...options };
    this.epi = { ...EPIDEMIOLOGY_DEFAULTS, ...options };
    /** @type {Map<string, import('./types').User>} */
    this.users = new Map();
    /** @type {import('./types').Anomaly[]} */
    this.anomalies = [];
    /** @type {import('./types').TimeWindow | null} */
    this._activeWindow = null;
    this._clusterSeq = 0;
  }

  /**
   * Register a monitored individual.
   * @param {string} userId - Pseudonymous user id
   * @param {Partial<import('./types').User>} profile
   * @returns {import('./types').User}
   */
  registerUser(userId, profile = {}) {
    const user = defineType(
      { userId, gender: 'unknown', ses: 'unknown', enrolledAt: new Date().toISOString() },
      { ...profile, userId },
    );
    this.users.set(userId, user);
    return user;
  }

  /**
   * Record a Level-1 anomaly for a registered user.
   * Events below `minMemberSeverity` are discarded.
   *
   * @param {string} userId
   * @param {Partial<import('./types').Anomaly>} anomalyData
   * @returns {import('./types').Anomaly | null}
   */
  recordAnomaly(userId, anomalyData = {}) {
    const user = this.users.get(userId);
    if (!user) return null;

    const location = anomalyData.location
      || user.lastKnownLocation
      || user.workplace?.location
      || user.homeLocation;
    if (!location?.lat || !location?.lng) return null;

    const anomaly = defineType(EMPTY_ANOMALY, {
      anomalyId: anomalyData.anomalyId || `AN-${crypto.randomBytes(4).toString('hex')}`,
      userId,
      detectedAt: anomalyData.detectedAt || new Date().toISOString(),
      observationDay: anomalyData.observationDay
        || (anomalyData.detectedAt || new Date().toISOString()).slice(0, 10),
      syndrome: anomalyData.syndrome || SYNDROME_TYPES.UNSPECIFIED,
      symptoms: anomalyData.symptoms || [],
      severity: anomalyData.severity ?? 0,
      confidence: anomalyData.confidence ?? 0,
      location: {
        ...location,
        geohash: location.geohash
          || encodeGeohash(location.lat, location.lng, this.thresholds.geohashPrecision),
      },
      alertTypes: anomalyData.alertTypes || [],
      anomalyFlag: anomalyData.anomalyFlag ?? true,
      features: anomalyData.features || {},
      status: anomalyData.status || 'new',
    });

    if (anomaly.severity < this.thresholds.minMemberSeverity) return null;
    this.anomalies.push(anomaly);
    return anomaly;
  }

  /**
   * Main entry: detect community clusters in a spatiotemporal window.
   *
   * @example
   * const clusters = engine.detectCommunityCluster(72, 500);
   *
   * @param {{ start?: string, end?: string, hours?: number } | number} [timeWindow]
   *   Time window spec. Number = hours lookback; default 72h.
   * @param {number} [geoRadius] - Spatial merge radius in meters (default 500)
   * @returns {DetectedCluster[]} Clusters meeting alert criteria, sorted by likelihood desc
   */
  detectCommunityCluster(timeWindow, geoRadius) {
    // 步骤1：获取时间窗口内的所有异常
    const anomalies = this.getAnomaliesInWindow(timeWindow);

    // 步骤2：按地理位置聚类（使用 Geohash）
    const geoClusters = this.groupByGeography(anomalies, geoRadius);

    // 步骤3：分析每个地理聚集，过滤满足预警条件的集群
    const clusters = geoClusters
      .map((geoCluster) => this.analyzeCluster(geoCluster))
      .filter((c) => c && this.meetsAlertCriteria(c));

    return clusters.sort((a, b) => b.likelihood - a.likelihood);
  }

  /**
   * 步骤1 — Collect anomalies whose `detectedAt` falls within the time window.
   *
   * @param {{ start?: string, end?: string, hours?: number } | number} [timeWindow]
   * @returns {import('./types').Anomaly[]}
   */
  getAnomaliesInWindow(timeWindow) {
    this._activeWindow = this.resolveTimeWindow(timeWindow);
    const startMs = new Date(this._activeWindow.start).getTime();
    const endMs = new Date(this._activeWindow.end).getTime();

    return this.anomalies.filter((a) => {
      const t = new Date(a.detectedAt).getTime();
      return t >= startMs && t <= endMs;
    });
  }

  /**
   * 步骤2 — Group anomalies by geohash, then merge cells within `geoRadius`.
   *
   * Algorithm:
   * 1. Assign each anomaly to a geohash cell (precision from CLUSTER_THRESHOLDS)
   * 2. Union-find merge of cells whose centers are ≤ geoRadius apart
   *
   * @param {import('./types').Anomaly[]} anomalies
   * @param {number} [geoRadius] - Meters (default CLUSTER_THRESHOLDS.proximityMeters)
   * @returns {GeoCluster[]}
   */
  groupByGeography(anomalies, geoRadius) {
    if (!anomalies.length) return [];

    const radiusM = geoRadius ?? this.thresholds.proximityMeters;
    const timeWindow = this._activeWindow || this.resolveTimeWindow(this.thresholds.timeWindowHours);
    const buckets = this._bucketByGeohash(anomalies);
    const mergedGroups = this._mergeBucketsWithinRadius(buckets, radiusM);

    return mergedGroups.map((group) => ({
      anomalies: group.anomalies,
      geohashKeys: group.geohashKeys,
      timeWindow,
      geoRadiusMeters: radiusM,
    }));
  }

  /**
   * 步骤3 — Build a {@link DetectedCluster} from a geographic group.
   * Computes epidemiological profile, severity, and outbreak likelihood.
   *
   * @param {GeoCluster} geoCluster
   * @returns {DetectedCluster | null} Null when group is too small or low-confidence
   */
  analyzeCluster(geoCluster) {
    const { anomalies, timeWindow, geoRadiusMeters } = geoCluster;
    const distinctUsers = unique(anomalies.map((a) => a.userId));

    if (distinctUsers.length < this.thresholds.minMembers) return null;

    const epiProfile = ClusterDetectionEngine.analyzeEpiProfile(anomalies, this.users);
    if (epiProfile.meanConfidence < this.thresholds.minMeanConfidence) return null;

    const lats = anomalies.map((a) => a.location.lat);
    const lngs = anomalies.map((a) => a.location.lng);
    const centroid = {
      lat: +avg(lats).toFixed(6),
      lng: +avg(lngs).toFixed(6),
      geohash: encodeGeohash(avg(lats), avg(lngs), this.thresholds.geohashPrecision),
      source: 'grid',
    };

    let maxDistM = 0;
    for (let i = 0; i < anomalies.length; i += 1) {
      for (let j = i + 1; j < anomalies.length; j += 1) {
        const dM = haversineKm(
          anomalies[i].location.lat, anomalies[i].location.lng,
          anomalies[j].location.lat, anomalies[j].location.lng,
        ) * 1000;
        if (dM > maxDistM) maxDistM = dM;
      }
    }

    const poiIds = unique(
      distinctUsers.map((uid) => this.users.get(uid)?.workplace?.poiId).filter(Boolean),
    );

    this._clusterSeq += 1;
    const reportingRate = this.epi.reportingRate || 0.15;
    const observedCount = distinctUsers.length;
    const baselineExpected = Math.max(0.5, observedCount * (1 - reportingRate) * 0.2);

    /** @type {DetectedCluster} */
    const cluster = {
      clusterId: `CL-${Date.now().toString(36)}-${this._clusterSeq}`,
      members: anomalies.map((a) => a.anomalyId),
      memberCount: observedCount,
      timeWindow,
      centroid,
      radiusMeters: Math.min(geoRadiusMeters, Math.round(maxDistM)),
      syndrome: epiProfile.dominantSyndrome,
      severity: 'low',
      likelihood: 0,
      baselineExpected: +baselineExpected.toFixed(2),
      observedCount,
      poiId: poiIds.length === 1 ? poiIds[0] : undefined,
      communityId: centroid.geohash,
      status: 'detected',
      detectedAt: new Date().toISOString(),
      epiProfile,
    };

    cluster.likelihood = ClusterDetectionEngine.calculateOutbreakLikelihood(cluster, this.epi);
    cluster.severity = ClusterDetectionEngine.calculateClusterSeverity(cluster);
    cluster.alertCriteria = ClusterDetectionEngine.evaluateAlertCriteria(
      cluster, this.thresholds, this.epi,
    );

    return cluster;
  }

  /**
   * Determine whether a analyzed cluster meets minimum PHM alert criteria.
   * Attaches {@link AlertCriteriaResult} to `cluster.alertCriteria`.
   *
   * @param {DetectedCluster} cluster
   * @returns {boolean} True when cluster qualifies for MONITOR tier or above
   */
  meetsAlertCriteria(cluster) {
    const criteria = cluster.alertCriteria
      || ClusterDetectionEngine.evaluateAlertCriteria(cluster, this.thresholds, this.epi);
    cluster.alertCriteria = criteria;
    return criteria.met;
  }

  /**
   * Normalize time window input to {@link import('./types').TimeWindow}.
   * @param {{ start?: string, end?: string, hours?: number } | number} [timeWindow]
   * @returns {import('./types').TimeWindow}
   */
  resolveTimeWindow(timeWindow) {
    const hours = typeof timeWindow === 'number'
      ? timeWindow
      : (timeWindow?.hours ?? this.thresholds.timeWindowHours);
    const end = timeWindow?.end ? new Date(timeWindow.end) : new Date();
    const start = timeWindow?.start
      ? new Date(timeWindow.start)
      : new Date(end.getTime() - hours * 3600 * 1000);
    return {
      start: start.toISOString(),
      end: end.toISOString(),
      durationHours: (end.getTime() - start.getTime()) / 3600000,
    };
  }

  /**
   * @private
   * @param {import('./types').Anomaly[]} events
   * @returns {Map<string, import('./types').Anomaly[]>}
   */
  _bucketByGeohash(events) {
    /** @type {Map<string, import('./types').Anomaly[]>} */
    const buckets = new Map();
    events.forEach((ev) => {
      const gh = ev.location?.geohash
        || encodeGeohash(ev.location.lat, ev.location.lng, this.thresholds.geohashPrecision);
      if (!buckets.has(gh)) buckets.set(gh, []);
      buckets.get(gh).push(ev);
    });
    return buckets;
  }

  /**
   * Union-find merge of geohash buckets within radius.
   * @private
   * @param {Map<string, import('./types').Anomaly[]>} buckets
   * @param {number} radiusM
   * @returns {{ anomalies: import('./types').Anomaly[], geohashKeys: string[] }[]}
   */
  _mergeBucketsWithinRadius(buckets, radiusM) {
    const entries = [...buckets.entries()].map(([hash, items]) => ({
      hash,
      items,
      center: decodeGeohash(hash),
    })).filter((e) => e.center);

    const parent = entries.map((_, i) => i);
    const find = (i) => {
      if (parent[i] !== i) parent[i] = find(parent[i]);
      return parent[i];
    };
    const union = (a, b) => { parent[find(a)] = find(b); };

    for (let i = 0; i < entries.length; i += 1) {
      for (let j = i + 1; j < entries.length; j += 1) {
        const km = haversineKm(
          entries[i].center.lat, entries[i].center.lng,
          entries[j].center.lat, entries[j].center.lng,
        );
        if (km * 1000 <= radiusM) union(i, j);
      }
    }

    /** @type {Map<number, { anomalies: import('./types').Anomaly[], geohashKeys: string[] }>} */
    const groups = new Map();
    entries.forEach((entry, i) => {
      const root = find(i);
      if (!groups.has(root)) groups.set(root, { anomalies: [], geohashKeys: [] });
      const g = groups.get(root);
      g.anomalies.push(...entry.items);
      g.geohashKeys.push(entry.hash);
    });

    return [...groups.values()];
  }

  /**
   * Analyze epidemiological characteristics: symptom concordance + population traits.
   * @param {import('./types').Anomaly[]} anomalies
   * @param {Map<string, import('./types').User>} users
   * @returns {ClusterEpiProfile}
   */
  static analyzeEpiProfile(anomalies, users) {
    const symptomCounts = {};
    const syndromeCounts = {};
    const ageBandDistribution = {};
    const workplaceTypes = {};
    let vulnerable = 0;

    anomalies.forEach((a) => {
      syndromeCounts[a.syndrome] = (syndromeCounts[a.syndrome] || 0) + 1;
      (a.symptoms || []).forEach((s) => {
        symptomCounts[s.type] = (symptomCounts[s.type] || 0) + 1;
      });
      const user = users.get(a.userId);
      if (user) {
        const band = ageBand(user.age);
        ageBandDistribution[band] = (ageBandDistribution[band] || 0) + 1;
        const wt = user.workplace?.type || 'unknown';
        workplaceTypes[wt] = (workplaceTypes[wt] || 0) + 1;
        const isVuln = (user.age != null && user.age >= 60)
          || (user.riskFactors?.length > 0)
          || user.ses === 'low';
        if (isVuln) vulnerable += 1;
      }
    });

    const dominantSyndrome = Object.entries(syndromeCounts).sort((a, b) => b[1] - a[1])[0]?.[0]
      || SYNDROME_TYPES.UNSPECIFIED;
    const dominantSymptoms = Object.entries(symptomCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k]) => k);

    const syndromeShare = (syndromeCounts[dominantSyndrome] || 0) / Math.max(anomalies.length, 1);
    const symptomShare = dominantSymptoms.length
      ? dominantSymptoms.reduce((s, sym) => s + (symptomCounts[sym] || 0), 0) / Math.max(anomalies.length, 1)
      : 0;
    const symptomConcordance = clamp01(syndromeShare * 0.6 + symptomShare * 0.4);

    const times = anomalies.map((a) => new Date(a.detectedAt).getTime()).sort((a, b) => a - b);
    const temporalSpanHours = times.length > 1
      ? (times[times.length - 1] - times[0]) / 3600000
      : 0;

    return {
      symptomConcordance: +symptomConcordance.toFixed(3),
      dominantSyndrome,
      dominantSymptoms,
      symptomCounts,
      ageBandDistribution,
      workplaceTypes,
      vulnerabilityRate: +(vulnerable / Math.max(anomalies.length, 1)).toFixed(3),
      meanSeverity: +avg(anomalies.map((a) => a.severity)).toFixed(3),
      meanConfidence: +avg(anomalies.map((a) => a.confidence)).toFixed(3),
      temporalSpanHours: +temporalSpanHours.toFixed(2),
    };
  }

  /**
   * Map member count + likelihood to cluster severity tier.
   * @param {DetectedCluster} cluster
   * @returns {'low' | 'medium' | 'high' | 'critical'}
   */
  static calculateClusterSeverity(cluster) {
    const tiers = ['critical', 'high', 'medium', 'low'];
    for (const tier of tiers) {
      const t = CLUSTER_SEVERITY_THRESHOLDS[tier];
      if (cluster.memberCount >= t.minMembers && cluster.likelihood >= t.minLikelihood) return tier;
    }
    return 'low';
  }

  /**
   * Estimate outbreak likelihood (0–1) from size, concordance, compactness, severity.
   * @param {DetectedCluster} cluster
   * @param {typeof EPIDEMIOLOGY_DEFAULTS} [epi]
   * @returns {number}
   */
  static calculateOutbreakLikelihood(cluster, epi = EPIDEMIOLOGY_DEFAULTS) {
    const profile = cluster.epiProfile || {};
    const minMembers = CLUSTER_THRESHOLDS.minMembers;

    const sizeScore = clamp01((cluster.memberCount - minMembers) / Math.max(minMembers * 3, 1));
    const concordance = profile.symptomConcordance ?? 0;
    const temporalScore = profile.temporalSpanHours != null
      ? clamp01(1 - profile.temporalSpanHours / CLUSTER_THRESHOLDS.timeWindowHours)
      : 0.5;
    const radius = cluster.radiusMeters ?? CLUSTER_THRESHOLDS.proximityMeters;
    const spatialScore = clamp01(1 - radius / CLUSTER_THRESHOLDS.proximityMeters);
    const severityScore = clamp01(profile.meanSeverity ?? 0);
    const confidenceScore = clamp01(profile.meanConfidence ?? 0);
    const excessScore = cluster.baselineExpected
      ? clamp01((cluster.observedCount - cluster.baselineExpected) / Math.max(cluster.baselineExpected, 1))
      : sizeScore;
    const workplaceFocus = profile.workplaceTypes
      ? Math.max(...Object.values(profile.workplaceTypes)) / Math.max(cluster.memberCount, 1)
      : 0;

    const raw = (
      sizeScore * 0.2 + concordance * 0.25 + temporalScore * 0.15
      + spatialScore * 0.1 + severityScore * 0.1 + confidenceScore * 0.1
      + excessScore * 0.05 + workplaceFocus * 0.05
    );
    const incubationFactor = clamp01(epi.incubationPeriodDays / epi.serialIntervalDays);
    return +clamp01(raw * (0.85 + incubationFactor * 0.15)).toFixed(3);
  }

  /**
   * Evaluate full alert criteria (MONITOR / ALERT / ACTION).
   * @param {DetectedCluster} cluster
   * @param {typeof CLUSTER_THRESHOLDS} [thresholds]
   * @param {typeof EPIDEMIOLOGY_DEFAULTS} [epi]
   * @returns {AlertCriteriaResult}
   */
  static evaluateAlertCriteria(cluster, thresholds = CLUSTER_THRESHOLDS, epi = EPIDEMIOLOGY_DEFAULTS) {
    const reasons = [];
    const profile = cluster.epiProfile || {};

    if (cluster.memberCount < thresholds.minMembers) {
      return { met: false, level: 0, levelLabel: 'NONE', reasons: ['member_count_below_threshold'] };
    }
    reasons.push(`member_count_${cluster.memberCount}`);

    let level = ALERT_LEVELS.MONITOR;
    if (profile.symptomConcordance >= 0.5) reasons.push('symptom_concordance_elevated');

    if (
      cluster.likelihood >= 0.45
      && profile.symptomConcordance >= 0.6
      && cluster.memberCount >= thresholds.minMembers + 1
    ) {
      level = ALERT_LEVELS.ALERT;
      reasons.push('cluster_likelihood_alert');
    }

    if (
      cluster.severity === 'critical' || cluster.severity === 'high'
      || (cluster.likelihood >= 0.75 && profile.symptomConcordance >= 0.7)
      || (cluster.memberCount >= epi.minAbsoluteCasesForAlert && cluster.likelihood >= 0.65)
    ) {
      level = ALERT_LEVELS.ACTION;
      reasons.push('outbreak_action_threshold');
    }

    return {
      met: level >= ALERT_LEVELS.MONITOR,
      level,
      levelLabel: ALERT_LEVEL_LABELS[level] || 'MONITOR',
      reasons,
    };
  }

  /** @deprecated Use {@link evaluateAlertCriteria} */
  static meetsAlertCriteria(cluster, thresholds, epi) {
    return ClusterDetectionEngine.evaluateAlertCriteria(cluster, thresholds, epi);
  }

  /** Reset in-memory state (for tests / batch replay). */
  reset() {
    this.users.clear();
    this.anomalies = [];
    this._activeWindow = null;
    this._clusterSeq = 0;
  }

  /** @returns {{ engineVersion: string, registeredUsers: number, recordedAnomalies: number, thresholds: object }} */
  getStats() {
    return {
      engineVersion: PHM_ENGINE_VERSION,
      registeredUsers: this.users.size,
      recordedAnomalies: this.anomalies.length,
      thresholds: this.thresholds,
    };
  }
}

module.exports = {
  ClusterDetectionEngine,
  encodeGeohash,
  decodeGeohash,
  expandGeohashNeighborhood,
};
