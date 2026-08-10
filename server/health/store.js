/**
 * Health data store — SQLite-backed persistence (replaces health-store.json).
 * Public API preserved for backward compatibility.
 */
const path = require('path');
const {
  EMPTY_STORE,
  assembleStore,
  saveStoreSnapshot,
  clearAll,
  hasData,
  initImportSession,
  ingestRecord,
  ingestRecordBatch,
  finalizeImport,
  dateKey,
  hourKey,
  parseAppleDate,
  normalizeAppleDateString,
} = require('./dao');
const { dbPath } = require('./db');
const { getDataDir } = require('../paths');

const DATA_DIR = getDataDir();
const STORE_FILE = path.join(DATA_DIR, 'health-store.json'); // legacy path reference only

function loadStore() {
  return assembleStore();
}

function saveStore(store) {
  saveStoreSnapshot(store);
}

function getStore() {
  return loadStore();
}

function clearStore() {
  clearAll();
}

function initStore(meta) {
  initImportSession(meta);
  return assembleStore();
}

module.exports = {
  DATA_DIR,
  STORE_FILE,
  dbPath,
  loadStore,
  saveStore,
  hasData,
  clearStore,
  getStore,
  initStore,
  ingestRecord,
  ingestRecordBatch,
  finalizeImport,
  finalizeStore: finalizeImport,
  dateKey,
  hourKey,
  parseAppleDate,
  normalizeAppleDateString,
  EMPTY_STORE,
};
