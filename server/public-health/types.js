/**
 * MedWear Public Health Monitoring (PHM) — core data contracts.
 * Level 1–4 pipeline: individual signal → cluster → regional alert → response.
 *
 * Plain JS + JSDoc; consumed by cluster detection, trend forecasting, and API routes.
 */

/**
 * Socioeconomic / vulnerability stratification (de-identified aggregates only).
 * @typedef {'low' | 'medium' | 'high' | 'unknown'} SesLevel
 */

/**
 * Geographic point with optional administrative hierarchy.
 * @typedef {Object} Location
 * @property {number} lat - WGS-84 latitude
 * @property {number} lng - WGS-84 longitude
 * @property {string} [geohash] - Geohash for spatial binning (privacy-preserving grid)
 * @property {string} [communityId] - Community / sub-district identifier
 * @property {string} [districtId] - District / county identifier
 * @property {string} [regionId] - City / prefecture identifier
 * @property {string} [addressLabel] - Human-readable label (avoid storing raw PII in production)
 * @property {'gps' | 'ip' | 'workplace' | 'home' | 'manual' | 'grid'} [source] - How location was inferred
 * @property {number} [accuracyMeters] - Horizontal accuracy when available
 */

/**
 * Workplace / POI context for cluster attribution.
 * @typedef {Object} Workplace
 * @property {string} [poiId] - Point-of-interest identifier (school, factory, nursing home)
 * @property {string} [name] - Display name
 * @property {'school' | 'factory' | 'office' | 'healthcare' | 'retail' | 'residential' | 'other'} [type]
 * @property {Location} [location] - Fixed site coordinates when known
 */

/**
 * Monitored individual (de-identified surveillance subject).
 * @typedef {Object} User
 * @property {string} userId - Pseudonymous identifier (never raw national ID)
 * @property {number} [age] - Age in years; prefer age band in production exports
 * @property {'male' | 'female' | 'other' | 'unknown'} [gender]
 * @property {Workplace} [workplace] - Primary daytime aggregation site
 * @property {Location} [homeLocation] - Residential grid (coarsened)
 * @property {Location} [lastKnownLocation] - Most recent inferred location
 * @property {SesLevel} [ses] - Socioeconomic / vulnerability proxy
 * @property {string[]} [riskFactors] - e.g. ['elderly', 'immunocompromised', 'healthcare_worker']
 * @property {string} [cohortId] - Study / deployment cohort for evaluation
 * @property {string} [deviceId] - Linked wearable device pseudonym
 * @property {string} [enrolledAt] - ISO-8601 enrollment timestamp
 */

/**
 * Wearable-derived or self-reported symptom proxy from Level-1 analytics.
 * @typedef {Object} SymptomSignal
 * @property {string} type - Key from SYMPTOM_TYPES (constants.js)
 * @property {number} weight - Severity weight 0–1 (often from SYMPTOM_SEVERITY_WEIGHTS)
 * @property {'wearable_proxy' | 'self_report' | 'clinical' | 'rule_engine'} [source]
 * @property {number} [confidence] - Detector confidence 0–1
 */

/**
 * Individual-level anomaly / syndromic signal (Level 1 output).
 * @typedef {Object} Anomaly
 * @property {string} anomalyId - Unique anomaly record id
 * @property {string} userId - Pseudonymous user reference
 * @property {string} detectedAt - ISO-8601 detection timestamp
 * @property {string} [observationDay] - Calendar day YYYY-MM-DD for daily aggregates
 * @property {string} syndrome - Primary syndrome bucket (respiratory, febrile, gastrointestinal, …)
 * @property {SymptomSignal[]} symptoms - Contributing symptom proxies
 * @property {number} severity - Composite severity score 0–1
 * @property {number} confidence - Overall detection confidence 0–1
 * @property {Location} [location] - Location at time of detection
 * @property {string[]} [alertTypes] - Rule hits aligned with analyticsCore (e.g. '血氧偏低')
 * @property {boolean} [anomalyFlag] - Statistical anomaly flag from wearable window
 * @property {Record<string, number>} [features] - Optional ML / rule feature snapshot
 * @property {'new' | 'confirmed' | 'resolved' | 'false_positive'} [status]
 */

/**
 * Time window for spatiotemporal cluster analysis.
 * @typedef {Object} TimeWindow
 * @property {string} start - ISO-8601 inclusive start
 * @property {string} end - ISO-8601 inclusive end
 * @property {number} durationHours - Window length in hours
 */

/**
 * Community / workplace cluster (Level 2 output).
 * @typedef {Object} Cluster
 * @property {string} clusterId - Unique cluster identifier
 * @property {string[]} members - Anomaly ids or userIds in the cluster
 * @property {number} memberCount - Distinct individuals meeting threshold
 * @property {TimeWindow} timeWindow - Analysis window
 * @property {Location} centroid - Spatial centroid or representative grid cell
 * @property {number} [radiusMeters] - Max pairwise distance or bounding radius
 * @property {string} syndrome - Dominant syndrome in the cluster
 * @property {'low' | 'medium' | 'high' | 'critical'} severity - Cluster severity tier
 * @property {number} likelihood - Estimated outbreak likelihood 0–1
 * @property {number} [baselineExpected] - Expected count under null hypothesis
 * @property {number} [observedCount] - Observed anomalous individuals
 * @property {string} [poiId] - Associated POI if workplace/school linked
 * @property {string} [communityId] - Administrative unit id
 * @property {'detected' | 'investigating' | 'confirmed' | 'closed'} [status]
 * @property {string} [detectedAt] - ISO-8601 when cluster was first flagged
 */

/**
 * Recommended public-health action item (Level 4 building block).
 * @typedef {Object} ResponseAction
 * @property {string} actionId
 * @property {string} type - e.g. 'surveillance', 'testing', 'isolation', 'communication'
 * @property {string} description - Human-readable action text
 * @property {'low' | 'medium' | 'high' | 'immediate'} priority
 * @property {string} [timeline] - e.g. 'within 24h', 'within 72h'
 * @property {string} [responsibleAgency] - e.g. 'CDC', 'district_health', 'school_board'
 * @property {string} [evidenceRef] - Guideline / playbook reference id
 */

/**
 * Stakeholder notification target.
 * @typedef {Object} Stakeholder
 * @property {string} role - e.g. 'epidemiologist', 'clinician', 'school_admin', 'public'
 * @property {string} [organization]
 * @property {'notify' | 'escalate' | 'coordinate'} [action]
 */

/**
 * Regional public-health alert (Level 3 / 4 output).
 * @typedef {Object} PublicHealthAlert
 * @property {string} alertId - Unique alert identifier
 * @property {'cluster' | 'trend' | 'outbreak' | 'environmental' | 'composite'} type
 * @property {1 | 2 | 3} level - ALERT_LEVELS: MONITOR=1, ALERT=2, ACTION=3
 * @property {'MONITOR' | 'ALERT' | 'ACTION'} levelLabel
 * @property {'low' | 'medium' | 'high' | 'critical'} severity
 * @property {string} syndrome - Primary syndrome under surveillance
 * @property {string} regionId - Geographic scope (district / city)
 * @property {string} title - Short alert headline
 * @property {string} summary - Narrative for dashboards
 * @property {string[]} [clusterIds] - Linked Level-2 clusters
 * @property {string[]} [anomalyIds] - Supporting Level-1 anomalies
 * @property {ResponseAction[]} actions - Recommended response actions
 * @property {Stakeholder[]} stakeholders - Who should be informed
 * @property {number} [rtEstimate] - Effective reproduction number proxy
 * @property {number} [growthRate] - Case growth rate (% per day)
 * @property {number} confidence - Alert confidence 0–1
 * @property {string} issuedAt - ISO-8601 issuance time
 * @property {string} [expiresAt] - ISO-8601 expiry / review time
 * @property {'active' | 'monitoring' | 'resolved' | 'superseded'} [status]
 */

/**
 * @typedef {Object} PhmPipelineResult
 * @property {Anomaly[]} anomalies
 * @property {Cluster[]} clusters
 * @property {PublicHealthAlert[]} alerts
 * @property {string} generatedAt
 * @property {string} engineVersion
 */

/** @type {Partial<User>} */
const EMPTY_USER = {
  userId: '',
  gender: 'unknown',
  ses: 'unknown',
};

/** @type {Partial<Location>} */
const EMPTY_LOCATION = {
  lat: 0,
  lng: 0,
  source: 'grid',
};

/** @type {Partial<Anomaly>} */
const EMPTY_ANOMALY = {
  anomalyId: '',
  userId: '',
  detectedAt: '',
  syndrome: 'unspecified',
  symptoms: [],
  severity: 0,
  confidence: 0,
  status: 'new',
};

/** @type {Partial<Cluster>} */
const EMPTY_CLUSTER = {
  clusterId: '',
  members: [],
  memberCount: 0,
  syndrome: 'unspecified',
  severity: 'low',
  likelihood: 0,
  status: 'detected',
};

/** @type {Partial<PublicHealthAlert>} */
const EMPTY_ALERT = {
  alertId: '',
  type: 'trend',
  level: 1,
  levelLabel: 'MONITOR',
  severity: 'low',
  syndrome: 'unspecified',
  regionId: '',
  title: '',
  summary: '',
  actions: [],
  stakeholders: [],
  confidence: 0,
  issuedAt: '',
  status: 'active',
};

/**
 * Merge partial object onto a typed template (immutable shallow merge).
 * @template T
 * @param {T} template
 * @param {Partial<T>} overrides
 * @returns {T}
 */
function defineType(template, overrides = {}) {
  return { ...template, ...overrides };
}

module.exports = {
  EMPTY_USER,
  EMPTY_LOCATION,
  EMPTY_ANOMALY,
  EMPTY_CLUSTER,
  EMPTY_ALERT,
  defineType,
};
