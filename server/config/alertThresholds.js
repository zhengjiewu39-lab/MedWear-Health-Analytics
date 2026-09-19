/** Single source for day-level alert rules (evaluateDayAlerts + dashboard). */
const DEFAULT_ALERT_THRESHOLDS = {
  heartRateMax: 100,
  heartRateMin: 50,
  spo2Min: 93,
  glucoseMax: 11.1,
};

module.exports = { DEFAULT_ALERT_THRESHOLDS };
