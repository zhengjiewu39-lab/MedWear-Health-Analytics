'use strict';

const path = require('path');
const { getDataDir, ensureDataDir } = require('../paths');

function dbPath() {
  return path.join(getDataDir(), 'health.db');
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

function getDb() {
  if (_db) return _db;
  ensureDataDir();
  const Database = require('better-sqlite3');
  _db = new Database(dbPath());
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  _db.pragma('synchronous = NORMAL');
  initSchema(_db);
  return _db;
}

function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
}

module.exports = {
  dbPath,
  getDb,
  closeDb,
  initSchema,
};
