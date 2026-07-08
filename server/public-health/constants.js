/**
 * MedWear Public Health Monitoring (PHM) — system constants.
 * Thresholds, alert tiers, symptom weights, and epidemiological defaults.
 */

/** Level-2 spatiotemporal cluster detection defaults. */
const CLUSTER_THRESHOLDS = {
  minMembers: 3,
  timeWindowHours: 72,
  proximityMeters: 500,
  /** Minimum composite anomaly severity (0–1) to count toward cluster. */
  minMemberSeverity: 0.35,
  /** Minimum mean pairwise confidence among members. */
  minMeanConfidence: 0.5,
  /** Geohash precision for grid aggregation (~152 m at precision 7). */
  geohashPrecision: 7,
};

/** Level-3 regional alert tiers (maps to response urgency). */
const ALERT_LEVELS = {
  MONITOR: 1,
  ALERT: 2,
  ACTION: 3,
};

/** Reverse lookup: numeric level → label. */
const ALERT_LEVEL_LABELS = {
  1: 'MONITOR',
  2: 'ALERT',
  3: 'ACTION',
};

/** Human-readable descriptions for dashboards and reports. */
const ALERT_LEVEL_META = {
  MONITOR: {
    level: 1,
    label: '监测',
    labelEn: 'MONITOR',
    description: '信号高于基线，持续观察，无需立即干预',
    color: '#1565C0',
  },
  ALERT: {
    level: 2,
    label: '预警',
    labelEn: 'ALERT',
    description: '聚集或趋势显著，启动加强监测与现场调查',
    color: '#EF6C00',
  },
  ACTION: {
    level: 3,
    label: '行动',
    labelEn: 'ACTION',
    description: '疑似暴发，触发公共卫生响应与多部门协调',
    color: '#C62828',
  },
};

/**
 * Canonical symptom / syndrome proxy keys (Level-1 → Level-2 aggregation).
 * Wearable proxies map from analyticsCore alert types where applicable.
 */
const SYMPTOM_TYPES = {
  FEVER: 'fever',
  COUGH: 'cough',
  SHORTNESS_OF_BREATH: 'shortness_of_breath',
  FATIGUE: 'fatigue',
  ACTIVITY_DROP: 'activity_drop',
  TACHYCARDIA: 'tachycardia',
  BRADYCARDIA: 'bradycardia',
  HYPOXEMIA: 'hypoxemia',
  SLEEP_DISRUPTION: 'sleep_disruption',
  GI_SYMPTOMS: 'gi_symptoms',
  HEADACHE: 'headache',
  SORE_THROAT: 'sore_throat',
};

/**
 * Severity weights for syndromic scoring (0–1).
 * Higher weight = stronger contribution to cluster / alert likelihood.
 */
const SYMPTOM_SEVERITY_WEIGHTS = {
  [SYMPTOM_TYPES.FEVER]: 0.9,
  [SYMPTOM_TYPES.COUGH]: 0.7,
  [SYMPTOM_TYPES.SHORTNESS_OF_BREATH]: 0.85,
  [SYMPTOM_TYPES.FATIGUE]: 0.5,
  [SYMPTOM_TYPES.ACTIVITY_DROP]: 0.6,
  [SYMPTOM_TYPES.TACHYCARDIA]: 0.55,
  [SYMPTOM_TYPES.BRADYCARDIA]: 0.45,
  [SYMPTOM_TYPES.HYPOXEMIA]: 0.9,
  [SYMPTOM_TYPES.SLEEP_DISRUPTION]: 0.4,
  [SYMPTOM_TYPES.GI_SYMPTOMS]: 0.65,
  [SYMPTOM_TYPES.HEADACHE]: 0.35,
  [SYMPTOM_TYPES.SORE_THROAT]: 0.5,
};

/** Map analyticsCore alert type strings → PHM symptom keys. */
const ANALYTICS_ALERT_TO_SYMPTOM = {
  '心率偏高': SYMPTOM_TYPES.TACHYCARDIA,
  '心率偏低': SYMPTOM_TYPES.BRADYCARDIA,
  '血氧偏低': SYMPTOM_TYPES.HYPOXEMIA,
  '活动量不足': SYMPTOM_TYPES.ACTIVITY_DROP,
  '心率异常波动': SYMPTOM_TYPES.TACHYCARDIA,
  '血氧偏低事件': SYMPTOM_TYPES.HYPOXEMIA,
};

/** Syndrome buckets for cluster / alert classification. */
const SYNDROME_TYPES = {
  RESPIRATORY: 'respiratory',
  FEBRILE: 'febrile',
  GASTROINTESTINAL: 'gastrointestinal',
  NEUROLOGICAL: 'neurological',
  UNSPECIFIED: 'unspecified',
};

/** Which symptoms roll up into each syndrome (for MVP rule-based grouping). */
const SYNDROME_SYMPTOM_MAP = {
  [SYNDROME_TYPES.RESPIRATORY]: [
    SYMPTOM_TYPES.COUGH,
    SYMPTOM_TYPES.SHORTNESS_OF_BREATH,
    SYMPTOM_TYPES.HYPOXEMIA,
    SYMPTOM_TYPES.SORE_THROAT,
  ],
  [SYNDROME_TYPES.FEBRILE]: [
    SYMPTOM_TYPES.FEVER,
    SYMPTOM_TYPES.TACHYCARDIA,
    SYMPTOM_TYPES.FATIGUE,
    SYMPTOM_TYPES.ACTIVITY_DROP,
  ],
  [SYNDROME_TYPES.GASTROINTESTINAL]: [
    SYMPTOM_TYPES.GI_SYMPTOMS,
    SYMPTOM_TYPES.FATIGUE,
    SYMPTOM_TYPES.ACTIVITY_DROP,
  ],
  [SYNDROME_TYPES.NEUROLOGICAL]: [
    SYMPTOM_TYPES.HEADACHE,
    SYMPTOM_TYPES.SLEEP_DISRUPTION,
    SYMPTOM_TYPES.FATIGUE,
  ],
};

/** Default epidemiological parameters for trend / alert escalation (tunable per region). */
const EPIDEMIOLOGY_DEFAULTS = {
  /** Mean serial interval (days) — respiratory syndrome prior. */
  serialIntervalDays: 3.5,
  /** Incubation period mean (days). */
  incubationPeriodDays: 2.5,
  /** Reporting rate assumption for passive wearable syndromic surveillance. */
  reportingRate: 0.15,
  /** Minimum active monitored population for stable regional rates. */
  minPopulationDenominator: 100,
  /** Baseline window for EWMA / CUSUM (days). */
  baselineWindowDays: 28,
  /** Trend comparison window (days). */
  trendWindowDays: 7,
  /** Relative increase vs baseline triggering MONITOR tier (fraction). */
  monitorThresholdRatio: 0.25,
  /** Relative increase triggering ALERT tier. */
  alertThresholdRatio: 0.5,
  /** Relative increase triggering ACTION tier. */
  actionThresholdRatio: 1.0,
  /** Minimum absolute case count for regional alert (avoid small-number noise). */
  minAbsoluteCasesForAlert: 5,
  /** CUSUM control limit (standard deviations). */
  cusumControlLimit: 4,
  /** Rt proxy above which escalation is recommended. */
  rtActionThreshold: 1.2,
};

/** Cluster severity tiers derived from member count & likelihood. */
const CLUSTER_SEVERITY_THRESHOLDS = {
  low: { minMembers: 3, minLikelihood: 0.3 },
  medium: { minMembers: 5, minLikelihood: 0.5 },
  high: { minMembers: 8, minLikelihood: 0.7 },
  critical: { minMembers: 12, minLikelihood: 0.85 },
};

/** Stakeholder roles for Level-4 response routing. */
const STAKEHOLDER_ROLES = {
  EPIDEMIOLOGIST: 'epidemiologist',
  DISTRICT_HEALTH: 'district_health',
  CLINICIAN: 'clinician',
  SCHOOL_ADMIN: 'school_admin',
  EMPLOYER: 'employer',
  PUBLIC: 'public',
  CDC: 'cdc',
};

/** PHM engine version string for audit trails. */
const PHM_ENGINE_VERSION = 'MedWear-PHM-v0.1';

module.exports = {
  CLUSTER_THRESHOLDS,
  ALERT_LEVELS,
  ALERT_LEVEL_LABELS,
  ALERT_LEVEL_META,
  SYMPTOM_TYPES,
  SYMPTOM_SEVERITY_WEIGHTS,
  ANALYTICS_ALERT_TO_SYMPTOM,
  SYNDROME_TYPES,
  SYNDROME_SYMPTOM_MAP,
  EPIDEMIOLOGY_DEFAULTS,
  CLUSTER_SEVERITY_THRESHOLDS,
  STAKEHOLDER_ROLES,
  PHM_ENGINE_VERSION,
};
