/**
 * Unit tests for {@link PublicHealthReporting}.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { PublicHealthReporting } = require('../public-health/reporting');
const { SYMPTOM_TYPES, SYNDROME_TYPES, ALERT_LEVELS } = require('../public-health/constants');

const DISTRICT = '110101';
const DATE = '2026-01-18';

function buildFixture() {
  const users = [
    {
      userId: 'U1', age: 34, gender: 'male', ses: 'low', deviceId: 'D1',
      lastKnownLocation: { lat: 39.9, lng: 116.4, districtId: DISTRICT },
      workplace: { poiId: 'POI-1', type: 'school', location: { lat: 39.9, lng: 116.4, districtId: DISTRICT } },
    },
    {
      userId: 'U2', age: 29, gender: 'female', ses: 'medium', deviceId: 'D2',
      lastKnownLocation: { lat: 39.901, lng: 116.401, districtId: DISTRICT },
      workplace: { poiId: 'POI-1', type: 'school', location: { lat: 39.901, lng: 116.401, districtId: DISTRICT } },
    },
    {
      userId: 'U3', age: 62, gender: 'male', ses: 'high', deviceId: 'D3',
      lastKnownLocation: { lat: 39.902, lng: 116.402, districtId: DISTRICT },
      workplace: { type: 'office', location: { lat: 39.902, lng: 116.402, districtId: DISTRICT } },
    },
  ];

  const anomalies = [
    {
      anomalyId: 'AN-1', userId: 'U1', detectedAt: `${DATE}T08:00:00.000Z`,
      observationDay: DATE, syndrome: SYNDROME_TYPES.RESPIRATORY, severity: 0.8, confidence: 0.85,
      symptoms: [{ type: SYMPTOM_TYPES.HYPOXEMIA, weight: 0.9 }, { type: SYMPTOM_TYPES.COUGH, weight: 0.7 }],
      location: { lat: 39.9, lng: 116.4, districtId: DISTRICT },
    },
    {
      anomalyId: 'AN-2', userId: 'U2', detectedAt: `${DATE}T10:00:00.000Z`,
      observationDay: DATE, syndrome: SYNDROME_TYPES.RESPIRATORY, severity: 0.75, confidence: 0.8,
      symptoms: [{ type: SYMPTOM_TYPES.HYPOXEMIA, weight: 0.9 }, { type: SYMPTOM_TYPES.COUGH, weight: 0.7 }],
      location: { lat: 39.901, lng: 116.401, districtId: DISTRICT },
    },
    {
      anomalyId: 'AN-3', userId: 'U3', detectedAt: `${DATE}T14:00:00.000Z`,
      observationDay: DATE, syndrome: SYNDROME_TYPES.FEBRILE, severity: 0.6, confidence: 0.7,
      symptoms: [{ type: SYMPTOM_TYPES.FEVER, weight: 0.9 }],
      location: { lat: 39.902, lng: 116.402, districtId: DISTRICT },
    },
  ];

  const clusters = [{
    clusterId: 'CL-TEST-001',
    members: ['AN-1', 'AN-2'],
    memberCount: 2,
    syndrome: SYNDROME_TYPES.RESPIRATORY,
    severity: 'medium',
    likelihood: 0.55,
    detectedAt: `${DATE}T12:00:00.000Z`,
    timeWindow: { start: `${DATE}T00:00:00.000Z`, end: `${DATE}T23:59:59.999Z`, durationHours: 24 },
    centroid: { lat: 39.9005, lng: 116.4005, geohash: 'wx4g0', source: 'grid' },
    radiusMeters: 200,
    poiId: 'POI-1',
    status: 'detected',
    epiProfile: {
      symptomConcordance: 0.85,
      dominantSyndrome: SYNDROME_TYPES.RESPIRATORY,
      dominantSymptoms: [SYMPTOM_TYPES.HYPOXEMIA, SYMPTOM_TYPES.COUGH],
      symptomCounts: { [SYMPTOM_TYPES.HYPOXEMIA]: 2, [SYMPTOM_TYPES.COUGH]: 2 },
      ageBandDistribution: { '18-35': 2 },
      workplaceTypes: { school: 2 },
      vulnerabilityRate: 0,
      meanSeverity: 0.775,
      meanConfidence: 0.825,
      temporalSpanHours: 2,
    },
    alertCriteria: { met: true, level: 2, levelLabel: 'ALERT', reasons: ['cluster_likelihood_alert'] },
  }];

  const alerts = [{
    alertId: 'AL-1',
    type: 'cluster',
    level: ALERT_LEVELS.ALERT,
    levelLabel: 'ALERT',
    severity: 'medium',
    syndrome: SYNDROME_TYPES.RESPIRATORY,
    regionId: DISTRICT,
    title: '东城区呼吸道信号聚集',
    summary: '检测到 2 人呼吸道相关异常聚集',
    clusterIds: ['CL-TEST-001'],
    actions: [],
    stakeholders: [],
    confidence: 0.7,
    issuedAt: `${DATE}T13:00:00.000Z`,
    status: 'active',
  }];

  return {
    users,
    anomalies,
    clusters,
    alerts,
    districts: {
      [DISTRICT]: { district_id: DISTRICT, district_name: '东城区', total_population: 450000 },
    },
  };
}

describe('PublicHealthReporting — generateDailyReport', () => {
  it('returns structured daily surveillance JSON with Chinese narrative', () => {
    const reporting = new PublicHealthReporting(buildFixture());
    const report = reporting.generateDailyReport(DATE, DISTRICT);

    assert.equal(report.report_type, 'daily_surveillance');
    assert.equal(report.report_date, DATE);
    assert.equal(report.district_id, DISTRICT);
    assert.ok(report.narrative_summary.includes('东城区'));
    assert.equal(report.monitoring_overview.total_monitored_population, 3);
    assert.equal(report.monitoring_overview.total_population_denominator, 450000);
    assert.ok(report.monitoring_overview.device_coverage > 0);
    assert.equal(report.anomalies_summary.total_anomalies, 3);
    assert.ok(report.anomalies_summary.by_type[SYMPTOM_TYPES.HYPOXEMIA] >= 2);
    assert.equal(report.clusters_detected.length, 1);
    assert.equal(report.alerts_issued.length, 1);
    assert.ok(Array.isArray(report.public_health_recommendations));
    assert.ok(report.data_quality_and_limitations.limitations.length >= 2);
  });
});

describe('PublicHealthReporting — generateInvestigationReport', () => {
  it('returns cluster investigation report with epidemic curve', () => {
    const reporting = new PublicHealthReporting(buildFixture());
    const report = reporting.generateInvestigationReport('CL-TEST-001');

    assert.ok(report);
    assert.equal(report.report_type, 'cluster_investigation');
    assert.equal(report.cluster_basics.member_count, 2);
    assert.ok(report.epidemic_curve.cases_by_day.length >= 1);
    assert.ok(report.symptom_profile.symptom_concordance >= 0.8);
    assert.ok(report.exposure_source_analysis.shared_poi_id === 'POI-1');
    assert.ok(report.recommended_interventions.length >= 2);
    assert.ok(report.prevention_measures.length >= 2);
  });

  it('returns null for unknown cluster id', () => {
    const reporting = new PublicHealthReporting(buildFixture());
    assert.equal(reporting.generateInvestigationReport('CL-MISSING'), null);
  });
});

describe('PublicHealthReporting — generateEquityAnalysisReport', () => {
  it('returns SES equity analysis with coverage and detection gaps', () => {
    const reporting = new PublicHealthReporting(buildFixture());
    const report = reporting.generateEquityAnalysisReport(DATE, DISTRICT);

    assert.equal(report.report_type, 'equity_analysis');
    assert.ok(report.ses_device_coverage.by_ses.low);
    assert.ok(report.ses_device_coverage.by_ses.high);
    assert.ok(typeof report.anomaly_detection_disparity.detection_rate_gap_high_vs_low === 'number');
    assert.ok(Array.isArray(report.equity_recommendations));
    assert.ok(report.narrative_summary.includes('健康公平性'));
  });
});
