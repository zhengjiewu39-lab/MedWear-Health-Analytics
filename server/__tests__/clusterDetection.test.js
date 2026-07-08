/**
 * Unit tests for {@link ClusterDetectionEngine} — Level-2 community cluster detection.
 *
 * Covers the three-step pipeline:
 *   getAnomaliesInWindow → groupByGeography → analyzeCluster → meetsAlertCriteria
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  ClusterDetectionEngine,
  encodeGeohash,
  decodeGeohash,
} = require('../public-health/cluster-detection');
const { SYMPTOM_TYPES, SYNDROME_TYPES, ALERT_LEVELS, CLUSTER_THRESHOLDS } = require('../public-health/constants');

/** @returns {Partial<import('../public-health/types').User>} */
function baseUser(id, lat, lng, extra = {}) {
  return {
    userId: id,
    age: extra.age ?? 30,
    workplace: {
      poiId: extra.poiId || 'POI-SCHOOL-1',
      type: extra.workplaceType || 'school',
      location: { lat, lng, source: 'workplace' },
    },
    lastKnownLocation: { lat, lng, source: 'gps' },
    riskFactors: extra.riskFactors || [],
    ses: extra.ses || 'medium',
  };
}

/** @returns {Partial<import('../public-health/types').Anomaly>} */
function respiratoryAnomaly(severity = 0.7, confidence = 0.8) {
  return {
    syndrome: SYNDROME_TYPES.RESPIRATORY,
    symptoms: [
      { type: SYMPTOM_TYPES.HYPOXEMIA, weight: 0.9, source: 'wearable_proxy', confidence },
      { type: SYMPTOM_TYPES.ACTIVITY_DROP, weight: 0.6, source: 'wearable_proxy', confidence },
    ],
    severity,
    confidence,
    alertTypes: ['血氧偏低'],
  };
}

/** Seed three users with respiratory anomalies in the same neighborhood. */
function seedOutbreakCluster(engine, opts = {}) {
  const now = Date.now();
  const ts = (offsetH) => new Date(now - offsetH * 3600000).toISOString();
  const baseLat = opts.lat ?? 39.9042;
  const baseLng = opts.lng ?? 116.4074;

  ['U1', 'U2', 'U3'].forEach((id, i) => {
    engine.registerUser(id, baseUser(id, baseLat + i * 0.0003, baseLng + i * 0.0003, { age: 28 + i }));
    engine.recordAnomaly(id, {
      ...respiratoryAnomaly(opts.severity ?? 0.75, opts.confidence ?? 0.85),
      detectedAt: ts(i * 6),
    });
  });
}

describe('geohash helpers', () => {
  it('encodes and decodes near original coordinates', () => {
    const hash = encodeGeohash(39.9042, 116.4074, 7);
    const decoded = decodeGeohash(hash);
    assert.equal(hash.length, 7);
    assert.ok(Math.abs(decoded.lat - 39.9042) < 0.01);
    assert.ok(Math.abs(decoded.lng - 116.4074) < 0.01);
  });
});

describe('ClusterDetectionEngine — step 1: getAnomaliesInWindow', () => {
  it('returns only anomalies within the 72h window', () => {
    const engine = new ClusterDetectionEngine();
    engine.registerUser('U1', baseUser('U1', 39.9042, 116.4074));

    const now = Date.now();
    engine.recordAnomaly('U1', {
      ...respiratoryAnomaly(),
      detectedAt: new Date(now - 24 * 3600000).toISOString(),
    });
    engine.recordAnomaly('U1', {
      ...respiratoryAnomaly(),
      anomalyId: 'AN-OLD',
      detectedAt: new Date(now - 100 * 3600000).toISOString(),
    });

    const inWindow = engine.getAnomaliesInWindow(72);
    assert.equal(inWindow.length, 1);
    assert.notEqual(inWindow[0].anomalyId, 'AN-OLD');
  });
});

describe('ClusterDetectionEngine — step 2: groupByGeography', () => {
  it('groups nearby anomalies into one geoCluster within 500m', () => {
    const engine = new ClusterDetectionEngine();
    seedOutbreakCluster(engine);

    const anomalies = engine.getAnomaliesInWindow(72);
    const geoClusters = engine.groupByGeography(anomalies, 500);

    assert.equal(geoClusters.length, 1);
    assert.equal(geoClusters[0].anomalies.length, 3);
    assert.ok(geoClusters[0].geohashKeys.length >= 1);
    assert.equal(geoClusters[0].geoRadiusMeters, 500);
  });

  it('splits distant anomalies into separate geoClusters', () => {
    const engine = new ClusterDetectionEngine();
    const now = Date.now();
    const ts = () => new Date(now).toISOString();

    engine.registerUser('NEAR', baseUser('NEAR', 39.9042, 116.4074));
    engine.registerUser('FAR', baseUser('FAR', 31.2304, 121.4737));
    engine.recordAnomaly('NEAR', { ...respiratoryAnomaly(), detectedAt: ts() });
    engine.recordAnomaly('FAR', { ...respiratoryAnomaly(), detectedAt: ts() });

    const anomalies = engine.getAnomaliesInWindow(72);
    const geoClusters = engine.groupByGeography(anomalies, 500);
    assert.equal(geoClusters.length, 2);
  });
});

describe('ClusterDetectionEngine — step 3: analyzeCluster + meetsAlertCriteria', () => {
  it('analyzeCluster computes epiProfile and likelihood', () => {
    const engine = new ClusterDetectionEngine();
    seedOutbreakCluster(engine);

    const geoClusters = engine.groupByGeography(engine.getAnomaliesInWindow(72), 500);
    const cluster = engine.analyzeCluster(geoClusters[0]);

    assert.ok(cluster);
    assert.equal(cluster.memberCount, 3);
    assert.equal(cluster.syndrome, SYNDROME_TYPES.RESPIRATORY);
    assert.ok(cluster.epiProfile.symptomConcordance >= 0.5);
    assert.ok(cluster.likelihood > 0);
    assert.ok(engine.meetsAlertCriteria(cluster));
  });

  it('analyzeCluster returns null when member count below minMembers', () => {
    const engine = new ClusterDetectionEngine();
    engine.registerUser('U1', baseUser('U1', 39.9042, 116.4074));
    engine.recordAnomaly('U1', respiratoryAnomaly());

    const geoClusters = engine.groupByGeography(engine.getAnomaliesInWindow(72), 500);
    assert.equal(engine.analyzeCluster(geoClusters[0]), null);
  });
});

describe('ClusterDetectionEngine — detectCommunityCluster (full pipeline)', () => {
  it('returns empty array when fewer than minMembers', () => {
    const engine = new ClusterDetectionEngine();
    engine.registerUser('U1', baseUser('U1', 39.9042, 116.4074));
    engine.registerUser('U2', baseUser('U2', 39.9043, 116.4075));
    engine.recordAnomaly('U1', respiratoryAnomaly());
    engine.recordAnomaly('U2', respiratoryAnomaly());

    assert.equal(engine.detectCommunityCluster(72, 500).length, 0);
  });

  it('detects cluster: 3 users, 72h, 500m, shared respiratory symptoms', () => {
    const engine = new ClusterDetectionEngine();
    seedOutbreakCluster(engine);

    const clusters = engine.detectCommunityCluster({ hours: 72 }, 500);
    assert.equal(clusters.length, 1);
    assert.equal(clusters[0].memberCount, CLUSTER_THRESHOLDS.minMembers);
    assert.equal(clusters[0].alertCriteria.met, true);
    assert.ok(clusters[0].alertCriteria.level >= ALERT_LEVELS.MONITOR);
  });

  it('rejects anomalies below minMemberSeverity', () => {
    const engine = new ClusterDetectionEngine();
    engine.registerUser('U1', baseUser('U1', 39.9042, 116.4074));
    assert.equal(engine.recordAnomaly('U1', respiratoryAnomaly(0.1, 0.3)), null);
    assert.equal(engine.anomalies.length, 0);
  });
});

describe('ClusterDetectionEngine — static helpers', () => {
  it('calculateClusterSeverity escalates with size and likelihood', () => {
    const severity = ClusterDetectionEngine.calculateClusterSeverity({
      memberCount: 10,
      likelihood: 0.75,
      epiProfile: { symptomConcordance: 0.8 },
    });
    assert.ok(['high', 'critical'].includes(severity));
  });

  it('evaluateAlertCriteria returns ACTION for high-likelihood clusters', () => {
    const criteria = ClusterDetectionEngine.evaluateAlertCriteria({
      memberCount: 8,
      likelihood: 0.8,
      severity: 'high',
      observedCount: 8,
      epiProfile: { symptomConcordance: 0.75, meanSeverity: 0.7, meanConfidence: 0.8 },
    });
    assert.equal(criteria.level, ALERT_LEVELS.ACTION);
    assert.equal(criteria.met, true);
  });
});
