'use strict';

const fs = require('fs');
const path = require('path');
const { getDataDir, ensureDataDir } = require('../paths');

function dbPath() {
  return path.join(getDataDir(), 'health.db');
}

function stagingDbPath() {
  return path.join(getDataDir(), 'health-staging.db');
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS store_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily (
      day TEXT PRIMARY KEY,
      steps REAL DEFAULT 0,
      active_energy REAL DEFAULT 0,
      distance REAL DEFAULT 0,
      resting_hr REAL,
      sleep_deep REAL DEFAULT 0,
      sleep_rem REAL DEFAULT 0,
      sleep_light REAL DEFAULT 0,
      sleep_awake REAL DEFAULT 0,
      sleep_inbed REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day TEXT NOT NULL,
      metric TEXT NOT NULL,
      value REAL NOT NULL,
      hour INTEGER,
      source_name TEXT,
      start_date TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_readings_day_metric ON readings(day, metric);

    CREATE TABLE IF NOT EXISTS sources (
      name TEXT PRIMARY KEY,
      product_type TEXT,
      count INTEGER DEFAULT 0,
      types_json TEXT DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS sleep_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day TEXT,
      stage TEXT,
      duration_min REAL,
      start_date TEXT,
      end_date TEXT,
      source_name TEXT
    );

    CREATE TABLE IF NOT EXISTS recent (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bucket TEXT NOT NULL,
      seq INTEGER NOT NULL,
      day TEXT,
      value REAL,
      hour INTEGER,
      source_name TEXT,
      start_date TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_recent_bucket ON recent(bucket, seq);
  `);
}

let _db = null;
/** During Apple Health import, all DAO writes go to a staging file until commit. */
let _importDb = null;

function openDatabase(filePath) {
  ensureDataDir();
  const Database = require('better-sqlite3');
  const db = new Database(filePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');
  initSchema(db);
  return db;
}

function getDb() {
  if (_importDb) return _importDb;
  if (_db) return _db;
  _db = openDatabase(dbPath());
  return _db;
}

function closeDb() {
  if (_importDb) {
    _importDb.close();
    _importDb = null;
  }
  if (_db) {
    _db.close();
    _db = null;
  }
}

function isImportDatabaseActive() {
  return _importDb != null;
}

/** Fresh staging DB — primary health.db is untouched until commitImportDatabase(). */
function beginImportDatabase() {
  if (_importDb) {
    _importDb.close();
    _importDb = null;
  }
  if (_db) {
    _db.close();
    _db = null;
  }
  const staging = stagingDbPath();
  if (fs.existsSync(staging)) fs.unlinkSync(staging);
  _importDb = openDatabase(staging);
  return _importDb;
}

function commitImportDatabase() {
  if (!_importDb) return getDb();
  _importDb.close();
  _importDb = null;
  const main = dbPath();
  const staging = stagingDbPath();
  const backup = `${main}.pre-import.bak`;
  if (!fs.existsSync(staging)) {
    return getDb();
  }
  if (fs.existsSync(main)) {
    if (fs.existsSync(backup)) fs.unlinkSync(backup);
    fs.renameSync(main, backup);
  }
  fs.renameSync(staging, main);
  if (fs.existsSync(backup)) {
    try { fs.unlinkSync(backup); } catch { /* optional retention */ }
  }
  return getDb();
}

function rollbackImportDatabase() {
  if (_importDb) {
    _importDb.close();
    _importDb = null;
  }
  const staging = stagingDbPath();
  if (fs.existsSync(staging)) {
    try { fs.unlinkSync(staging); } catch { /* ignore */ }
  }
  return getDb();
}

module.exports = {
  dbPath,
  stagingDbPath,
  getDb,
  closeDb,
  initSchema,
  isImportDatabaseActive,
  beginImportDatabase,
  commitImportDatabase,
  rollbackImportDatabase,
};
