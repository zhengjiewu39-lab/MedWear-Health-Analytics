const { classifyBHIWatchTier } = require('../config/bhiWatchTier');
const { computeDayScoreDetail } = require('../services/analyticsCore');

function resolveBhiFromDay(dayData, bhiOpts) {
  if (!dayData) {
    return {
      healthScore: null,
      bhiWatchTier: 'unknown',
      bhiUnavailable: true,
      bhiUnavailableReason: 'no_day_data',
    };
  }
  const detail = computeDayScoreDetail(dayData, bhiOpts);
  const score = detail.score;
  return {
    healthScore: score,
    bhiWatchTier: classifyBHIWatchTier(score),
    bhiUnavailable: score == null,
    bhiUnavailableReason: score == null ? 'insufficient_bhi_components' : null,
    bhiCoverage: detail.coverage,
    bhiMissing: detail.missing,
    bhiUnavailableComponents: detail.unavailable,
  };
}

module.exports = { resolveBhiFromDay };
