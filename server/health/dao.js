'use strict';

const fs = require('fs');
const path = require('path');
const { getDataDir } = require('../paths');
const { getDb } = require('./db');

const EMPTY_STORE = {
  meta: null,
  daily: {},
  sources: {},
  recent: { heartRate: [], spo2: [], hrv: [], steps: [] },
  sleepSessions: [],
  workouts: [],
};

const LEGACY_JSON = () => path.join(getDataDir(), 'health-store.json');
const RECENT_MAX = 500;
const SLEEP_MAX = 2000;

const SLEEP_STAGE_MAP = {
  HKCategoryValueSleepAnalysisAsleepDeep: 'deep',
  HKCategoryValueSleepAnalysisAsleepREM: 'rem',
  HKCategoryValueSleepAnalysisAsleepCore: 'light',
  HKCategoryValueSleepAnalysisAsleepUnspecified: 'light',
  HKCategoryValueSleepAnalysisAwake: 'awake',
  HKCategoryValueSleepAnalysisInBed: 'inBed',
};

// --- date helpers (shared with legacy store API) ---

function normalizeAppleDateString(isoStr) {
  if (!isoStr) return null;
  const s = String(isoStr).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{4})$/);
  if (m) {
    const tz = m[3].replace(/([+-])(\d{2})(\d{2})/, '$1$2:$3');
    return `${m[1]}T${m[2]}${tz}`;
  }
  if (/^\d{4}-\d{2}-\d{2} /.test(s)) return s.replace(' ', 'T');
  return s;
}

function parseAppleDate(isoStr) {
  const normalized = normalizeAppleDateString(isoStr);
  if (!normalized) return null;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dateKey(isoStr) {
  if (!isoStr) return null;
  const m = String(isoStr).trim().match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = parseAppleDate(isoStr);
  return d ? d.toISOString().slice(0, 10) : null;
}

function hourKey(isoStr) {
  if (!isoStr) return null;
  const m = String(isoStr).trim().match(/^\d{4}-\d{2}-\d{2} (\d{2}):/);
  if (m) return parseInt(m[1], 10);
  const d = parseAppleDate(isoStr);
  return d ? d.getHours() : null;
}

// --- migration ---

function migrateFromJsonIfNeeded() {
  const jsonPath = LEGACY_JSON();
  const db = getDb();
  const row = db.prepare('SELECT value FROM store_meta WHERE key = ?').get('migrated');
  if (row) return;

  if (fs.existsSync(jsonPath)) {
    try {
      const legacy = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      if (legacy.meta || Object.keys(legacy.daily || {}).length) {
        saveStoreSnapshot(legacy);
      }
    } catch {
      /* ignore corrupt legacy file */
    }
  }

  db.prepare('INSERT OR REPLACE INTO store_meta (key, value) VALUES (?, ?)').run(
    'migrated',
    new Date().toISOString(),
  );
}

// --- assemble / persist full store snapshot ---

function assembleStore() {
  migrateFromJsonIfNeeded();
  const db = getDb();

  const metaRow = db.prepare('SELECT value FROM store_meta WHERE key = ?').get('meta');
  const meta = metaRow ? JSON.parse(metaRow.value) : null;

  const dailyRows = db.prepare('SELECT * FROM daily ORDER BY day').all();
  const daily = {};
  dailyRows.forEach((r) => {
    daily[r.day] = {
      steps: r.steps || 0,
      activeEnergy: r.active_energy || 0,
      distance: r.distance || 0,
      restingHeartRate: r.resting_hr,
      heartRate: [],
      spo2: [],
      hrv: [],
      respiratoryRate: [],
      sleepMinutes: {
        deep: r.sleep_deep || 0,
        rem: r.sleep_rem || 0,
        light: r.sleep_light || 0,
        awake: r.sleep_awake || 0,
        inBed: r.sleep_inbed || 0,
      },
    };
  });

  const readings = db.prepare('SELECT day, metric, value FROM readings ORDER BY id').all();
  readings.forEach((r) => {
    const bucket = r.metric === 'heartRate' ? 'heartRate'
      : r.metric === 'spo2' ? 'spo2'
        : r.metric === 'hrv' ? 'hrv'
          : r.metric === 'respiratoryRate' ? 'respiratoryRate' : null;
    if (bucket && daily[r.day]) daily[r.day][bucket].push(r.value);
  });

  const sources = {};
  db.prepare('SELECT * FROM sources').all().forEach((s) => {
    sources[s.name] = {
      name: s.name,
      productType: s.product_type || '',
      count: s.count || 0,
      types: JSON.parse(s.types_json || '{}'),
    };
  });

  const recent = { heartRate: [], spo2: [], hrv: [], steps: [] };
  db.prepare('SELECT * FROM recent ORDER BY bucket, seq').all().forEach((r) => {
    if (!recent[r.bucket]) return;
    recent[r.bucket].push({
      day: r.day,
      value: r.value,
      hour: r.hour,
      sourceName: r.source_name,
      startDate: r.start_date,
    });
  });

  const sleepSessions = db.prepare('SELECT * FROM sleep_sessions ORDER BY id').all().map((s) => ({
    day: s.day,
    stage: s.stage,
    durationMin: s.duration_min,
    startDate: s.start_date,
    endDate: s.end_date,
    sourceName: s.source_name,
  }));

  return {
    meta,
    daily,
    sources,
    recent,
    sleepSessions,
    workouts: [],
  };
}

function saveStoreSnapshot(store) {
  const db = getDb();
  const tx = db.transaction((s) => {
    db.prepare('DELETE FROM store_meta').run();
    db.prepare('DELETE FROM daily').run();
    db.prepare('DELETE FROM readings').run();
    db.prepare('DELETE FROM sources').run();
    db.prepare('DELETE FROM sleep_sessions').run();
    db.prepare('DELETE FROM recent').run();

    if (s.meta) {
      db.prepare('INSERT INTO store_meta (key, value) VALUES (?, ?)').run('meta', JSON.stringify(s.meta));
    }

    Object.entries(s.daily || {}).forEach(([day, d]) => {
      db.prepare(`
        INSERT INTO daily (day, steps, active_energy, distance, resting_hr,
          sleep_deep, sleep_rem, sleep_light, sleep_awake, sleep_inbed)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        day, d.steps || 0, d.activeEnergy || 0, d.distance || 0, d.restingHeartRate ?? null,
        d.sleepMinutes?.deep || 0, d.sleepMinutes?.rem || 0, d.sleepMinutes?.light || 0,
        d.sleepMinutes?.awake || 0, d.sleepMinutes?.inBed || 0,
      );

      (d.heartRate || []).forEach((v) => {
        db.prepare('INSERT INTO readings (day, metric, value) VALUES (?, ?, ?)').run(day, 'heartRate', v);
      });
      (d.spo2 || []).forEach((v) => {
        db.prepare('INSERT INTO readings (day, metric, value) VALUES (?, ?, ?)').run(day, 'spo2', v);
      });
      (d.hrv || []).forEach((v) => {
        db.prepare('INSERT INTO readings (day, metric, value) VALUES (?, ?, ?)').run(day, 'hrv', v);
      });
      (d.respiratoryRate || []).forEach((v) => {
        db.prepare('INSERT INTO readings (day, metric, value) VALUES (?, ?, ?)').run(day, 'respiratoryRate', v);
      });
    });

    Object.values(s.sources || {}).forEach((src) => {
      db.prepare('INSERT INTO sources (name, product_type, count, types_json) VALUES (?, ?, ?, ?)').run(
        src.name, src.productType || '', src.count || 0, JSON.stringify(src.types || {}),
      );
    });

    Object.entries(s.recent || {}).forEach(([bucket, items]) => {
      (items || []).forEach((item, seq) => {
        db.prepare(`
          INSERT INTO recent (bucket, seq, day, value, hour, source_name, start_date)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(bucket, seq, item.day, item.value, item.hour ?? null, item.sourceName || null, item.startDate || null);
      });
    });

    (s.sleepSessions || []).forEach((sess) => {
      db.prepare(`
        INSERT INTO sleep_sessions (day, stage, duration_min, start_date, end_date, source_name)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(sess.day, sess.stage, sess.durationMin, sess.startDate, sess.endDate, sess.sourceName);
    });

    db.prepare('INSERT OR REPLACE INTO store_meta (key, value) VALUES (?, ?)').run(
      'migrated',
      new Date().toISOString(),
    );
  });

  tx(store);
}

// --- incremental ingest (used by XML parser) ---

function clearAll() {
  saveStoreSnapshot(JSON.parse(JSON.stringify(EMPTY_STORE)));
}

function hasData() {
  migrateFromJsonIfNeeded();
  const db = getDb();
  const meta = db.prepare('SELECT value FROM store_meta WHERE key = ?').get('meta');
  const dayCount = db.prepare('SELECT COUNT(*) AS n FROM daily').get().n;
  if (!meta) return dayCount > 0;
  try {
    const parsed = JSON.parse(meta.value);
    return Boolean(parsed.dayCount > 0 || dayCount > 0);
  } catch {
    return dayCount > 0;
  }
}

function initImportSession(meta) {
  clearAll();
  const db = getDb();
  db.prepare('INSERT INTO store_meta (key, value) VALUES (?, ?)').run('meta', JSON.stringify(meta));
  return { meta };
}

function ensureDailyRow(db, day) {
  db.prepare(`
    INSERT OR IGNORE INTO daily (day) VALUES (?)
  `).run(day);
}

function addSource(db, sourceName, productType) {
  const key = sourceName || 'Unknown';
  const existing = db.prepare('SELECT count FROM sources WHERE name = ?').get(key);
  if (existing) {
    db.prepare('UPDATE sources SET count = count + 1 WHERE name = ?').run(key);
  } else {
    db.prepare('INSERT INTO sources (name, product_type, count, types_json) VALUES (?, ?, 1, ?)').run(
      key, productType || '', '{}',
    );
  }
}

function pushRecentDb(db, bucket, item) {
  const maxSeq = db.prepare('SELECT COALESCE(MAX(seq), -1) AS m FROM recent WHERE bucket = ?').get(bucket).m;
  const seq = maxSeq + 1;
  db.prepare(`
    INSERT INTO recent (bucket, seq, day, value, hour, source_name, start_date)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(bucket, seq, item.day, item.value, item.hour ?? null, item.sourceName || null, item.startDate || null);

  const overflow = db.prepare('SELECT COUNT(*) AS n FROM recent WHERE bucket = ?').get(bucket).n - RECENT_MAX;
  if (overflow > 0) {
    db.prepare(`
      DELETE FROM recent WHERE id IN (
        SELECT id FROM recent WHERE bucket = ? ORDER BY seq ASC LIMIT ?
      )
    `).run(bucket, overflow);
  }
}

function ingestRecordInternal(db, record) {
  const { type, value, startDate, endDate, sourceName, sourceVersion, device } = record;
  const productType = device || sourceVersion || '';
  addSource(db, sourceName, productType);

  const day = dateKey(startDate);
  if (!day) return;

  const numVal = parseFloat(value);
  const start = parseAppleDate(startDate);
  const end = parseAppleDate(endDate);
  const durationMin = start && end ? Math.max(0, (end - start) / 60000) : 0;
  const src = { sourceName, startDate, value: numVal };

  ensureDailyRow(db, day);

  switch (type) {
    case 'HKQuantityTypeIdentifierStepCount':
      if (!Number.isNaN(numVal)) {
        db.prepare('UPDATE daily SET steps = steps + ? WHERE day = ?').run(numVal, day);
        pushRecentDb(db, 'steps', { ...src, day });
      }
      break;
    case 'HKQuantityTypeIdentifierActiveEnergyBurned':
      if (!Number.isNaN(numVal)) db.prepare('UPDATE daily SET active_energy = active_energy + ? WHERE day = ?').run(numVal, day);
      break;
    case 'HKQuantityTypeIdentifierDistanceWalkingRunning':
      if (!Number.isNaN(numVal)) db.prepare('UPDATE daily SET distance = distance + ? WHERE day = ?').run(numVal, day);
      break;
    case 'HKQuantityTypeIdentifierHeartRate':
      if (!Number.isNaN(numVal) && numVal > 30 && numVal < 220) {
        db.prepare('INSERT INTO readings (day, metric, value, hour, source_name, start_date) VALUES (?, ?, ?, ?, ?, ?)').run(
          day, 'heartRate', numVal, hourKey(startDate), sourceName || null, startDate || null,
        );
        pushRecentDb(db, 'heartRate', { ...src, day, hour: hourKey(startDate) });
      }
      break;
    case 'HKQuantityTypeIdentifierRestingHeartRate':
      if (!Number.isNaN(numVal)) db.prepare('UPDATE daily SET resting_hr = ? WHERE day = ?').run(numVal, day);
      break;
    case 'HKQuantityTypeIdentifierOxygenSaturation':
      if (!Number.isNaN(numVal)) {
        const spo2 = numVal <= 1 ? numVal * 100 : numVal;
        db.prepare('INSERT INTO readings (day, metric, value, hour, source_name, start_date) VALUES (?, ?, ?, ?, ?, ?)').run(
          day, 'spo2', spo2, hourKey(startDate), sourceName || null, startDate || null,
        );
        pushRecentDb(db, 'spo2', { ...src, value: spo2, day, hour: hourKey(startDate) });
      }
      break;
    case 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN':
      if (!Number.isNaN(numVal)) {
        db.prepare('INSERT INTO readings (day, metric, value, source_name, start_date) VALUES (?, ?, ?, ?, ?)').run(
          day, 'hrv', numVal, sourceName || null, startDate || null,
        );
        pushRecentDb(db, 'hrv', { ...src, day });
      }
      break;
    case 'HKQuantityTypeIdentifierRespiratoryRate':
      if (!Number.isNaN(numVal)) {
        db.prepare('INSERT INTO readings (day, metric, value) VALUES (?, ?, ?)').run(day, 'respiratoryRate', numVal);
      }
      break;
    case 'HKCategoryTypeIdentifierSleepAnalysis': {
      const stage = SLEEP_STAGE_MAP[value] || 'light';
      const col = stage === 'deep' ? 'sleep_deep'
        : stage === 'rem' ? 'sleep_rem'
          : stage === 'light' ? 'sleep_light'
            : stage === 'awake' ? 'sleep_awake' : 'sleep_inbed';
      db.prepare(`UPDATE daily SET ${col} = ${col} + ? WHERE day = ?`).run(durationMin, day);
      db.prepare(`
        INSERT INTO sleep_sessions (day, stage, duration_min, start_date, end_date, source_name)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(day, stage, durationMin, startDate, endDate, sourceName || null);
      const count = db.prepare('SELECT COUNT(*) AS n FROM sleep_sessions').get().n;
      if (count > SLEEP_MAX) {
        db.prepare(`
          DELETE FROM sleep_sessions WHERE id IN (
            SELECT id FROM sleep_sessions ORDER BY id ASC LIMIT ?
          )
        `).run(count - SLEEP_MAX);
      }
      break;
    }
    default:
      break;
  }
}

function ingestRecord(record) {
  const db = getDb();
  ingestRecordInternal(db, record);
}

function ingestRecordBatch(records) {
  if (!records.length) return;
  const db = getDb();
  const tx = db.transaction((recs) => {
    recs.forEach((r) => ingestRecordInternal(db, r));
  });
  tx(records);
}

function finalizeImport(parseStats) {
  const db = getDb();
  const days = db.prepare('SELECT day FROM daily ORDER BY day').all().map((r) => r.day);
  const metaRow = db.prepare('SELECT value FROM store_meta WHERE key = ?').get('meta');
  const meta = metaRow ? JSON.parse(metaRow.value) : {};
  const sourceList = db.prepare('SELECT name, product_type AS productType, count FROM sources ORDER BY count DESC').all();

  const finalized = {
    ...meta,
    ...parseStats,
    dateRange: days.length ? { start: days[0], end: days[days.length - 1] } : null,
    dayCount: days.length,
    sourceList,
  };

  db.prepare('INSERT OR REPLACE INTO store_meta (key, value) VALUES (?, ?)').run('meta', JSON.stringify(finalized));
  return assembleStore();
}

module.exports = {
  EMPTY_STORE,
  LEGACY_JSON,
  assembleStore,
  saveStoreSnapshot,
  migrateFromJsonIfNeeded,
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
};
