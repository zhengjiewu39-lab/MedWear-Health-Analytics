const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
const STORE_FILE = path.join(DATA_DIR, 'health-store.json');

const EMPTY_STORE = {
  meta: null,
  daily: {},
  sources: {},
  recent: {
    heartRate: [],
    spo2: [],
    hrv: [],
    steps: [],
  },
  sleepSessions: [],
  workouts: [],
};

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadStore() {
  ensureDir();
  if (!fs.existsSync(STORE_FILE)) return JSON.parse(JSON.stringify(EMPTY_STORE));
  try {
    return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
  } catch {
    return JSON.parse(JSON.stringify(EMPTY_STORE));
  }
}

function saveStore(store) {
  ensureDir();
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
}

function hasData() {
  const store = loadStore();
  return Boolean(store.meta && (store.meta.dayCount > 0 || Object.keys(store.daily || {}).length > 0));
}

function clearStore() {
  saveStore(JSON.parse(JSON.stringify(EMPTY_STORE)));
}

function getStore() {
  return loadStore();
}

function initStore(meta) {
  const store = JSON.parse(JSON.stringify(EMPTY_STORE));
  store.meta = meta;
  return store;
}

function addSource(store, sourceName, productType) {
  const key = sourceName || 'Unknown';
  if (!store.sources[key]) {
    store.sources[key] = { name: key, productType: productType || '', count: 0, types: {} };
  }
  store.sources[key].count += 1;
}

/** Parse Apple Health export.xml timestamps (e.g. "2024-01-15 08:00:00 +0800"). */
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

function ensureDaily(store, day) {
  if (!store.daily[day]) {
    store.daily[day] = {
      steps: 0,
      activeEnergy: 0,
      distance: 0,
      heartRate: [],
      restingHeartRate: null,
      spo2: [],
      hrv: [],
      respiratoryRate: [],
      sleepMinutes: { deep: 0, rem: 0, light: 0, awake: 0, inBed: 0 },
    };
  }
  return store.daily[day];
}

function pushRecent(store, bucket, item, maxLen = 500) {
  store.recent[bucket].push(item);
  if (store.recent[bucket].length > maxLen) {
    store.recent[bucket] = store.recent[bucket].slice(-maxLen);
  }
}

const SLEEP_STAGE_MAP = {
  HKCategoryValueSleepAnalysisAsleepDeep: 'deep',
  HKCategoryValueSleepAnalysisAsleepREM: 'rem',
  HKCategoryValueSleepAnalysisAsleepCore: 'light',
  HKCategoryValueSleepAnalysisAsleepUnspecified: 'light',
  HKCategoryValueSleepAnalysisAwake: 'awake',
  HKCategoryValueSleepAnalysisInBed: 'inBed',
};

function ingestRecord(store, record) {
  const { type, value, startDate, endDate, sourceName, sourceVersion, device } = record;
  const productType = device || sourceVersion || '';
  addSource(store, sourceName, productType);

  const day = dateKey(startDate);
  if (!day) return;

  const numVal = parseFloat(value);
  const start = parseAppleDate(startDate);
  const end = parseAppleDate(endDate);
  const durationMin = start && end ? Math.max(0, (end - start) / 60000) : 0;

  const src = { sourceName, startDate, value: numVal };

  switch (type) {
    case 'HKQuantityTypeIdentifierStepCount':
      if (!Number.isNaN(numVal)) {
        const daily = ensureDaily(store, day);
        daily.steps += numVal;
        pushRecent(store, 'steps', { ...src, day });
      }
      break;
    case 'HKQuantityTypeIdentifierActiveEnergyBurned':
      if (!Number.isNaN(numVal)) ensureDaily(store, day).activeEnergy += numVal;
      break;
    case 'HKQuantityTypeIdentifierDistanceWalkingRunning':
      if (!Number.isNaN(numVal)) ensureDaily(store, day).distance += numVal;
      break;
    case 'HKQuantityTypeIdentifierHeartRate':
      if (!Number.isNaN(numVal) && numVal > 30 && numVal < 220) {
        ensureDaily(store, day).heartRate.push(numVal);
        pushRecent(store, 'heartRate', { ...src, day, hour: hourKey(startDate) });
      }
      break;
    case 'HKQuantityTypeIdentifierRestingHeartRate':
      if (!Number.isNaN(numVal)) ensureDaily(store, day).restingHeartRate = numVal;
      break;
    case 'HKQuantityTypeIdentifierOxygenSaturation':
      if (!Number.isNaN(numVal)) {
        const spo2 = numVal <= 1 ? numVal * 100 : numVal;
        ensureDaily(store, day).spo2.push(spo2);
        pushRecent(store, 'spo2', { ...src, value: spo2, day, hour: hourKey(startDate) });
      }
      break;
    case 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN':
      if (!Number.isNaN(numVal)) {
        ensureDaily(store, day).hrv.push(numVal);
        pushRecent(store, 'hrv', { ...src, day });
      }
      break;
    case 'HKQuantityTypeIdentifierRespiratoryRate':
      if (!Number.isNaN(numVal)) ensureDaily(store, day).respiratoryRate.push(numVal);
      break;
    case 'HKCategoryTypeIdentifierSleepAnalysis': {
      const stage = SLEEP_STAGE_MAP[value] || 'light';
      ensureDaily(store, day).sleepMinutes[stage] += durationMin;
      store.sleepSessions.push({
        day, stage, durationMin, startDate, endDate, sourceName,
      });
      if (store.sleepSessions.length > 2000) store.sleepSessions = store.sleepSessions.slice(-2000);
      break;
    }
    default:
      break;
  }
}

function finalizeStore(store, parseStats) {
  const days = Object.keys(store.daily).sort();
  store.meta = {
    ...store.meta,
    ...parseStats,
    dateRange: days.length ? { start: days[0], end: days[days.length - 1] } : null,
    dayCount: days.length,
    sourceList: Object.values(store.sources).sort((a, b) => b.count - a.count),
  };
  return store;
}

module.exports = {
  DATA_DIR,
  STORE_FILE,
  loadStore,
  saveStore,
  hasData,
  clearStore,
  getStore,
  initStore,
  ingestRecord,
  finalizeStore,
  dateKey,
  hourKey,
  parseAppleDate,
  normalizeAppleDateString,
};
