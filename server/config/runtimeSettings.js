const fs = require('fs');
const path = require('path');
const { getDataDir, ensureDataDir } = require('../paths');
const { DEFAULT_ALERT_THRESHOLDS } = require('./alertThresholds');

const FILE = path.join(getDataDir(), 'runtime-settings.json');

function loadRuntimeSettings() {
  ensureDataDir();
  try {
    if (fs.existsSync(FILE)) {
      const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'));
      return {
        alertThresholds: { ...DEFAULT_ALERT_THRESHOLDS, ...(parsed.alertThresholds || {}) },
      };
    }
  } catch {
    /* ignore corrupt file — fall back to defaults */
  }
  return { alertThresholds: { ...DEFAULT_ALERT_THRESHOLDS } };
}

function saveAlertThresholds(partial) {
  ensureDataDir();
  const alertThresholds = {
    ...DEFAULT_ALERT_THRESHOLDS,
    ...loadRuntimeSettings().alertThresholds,
    ...partial,
  };
  fs.writeFileSync(FILE, JSON.stringify({ alertThresholds, updatedAt: new Date().toISOString() }, null, 2));
  return alertThresholds;
}

module.exports = { loadRuntimeSettings, saveAlertThresholds, SETTINGS_FILE: FILE };
