const { findNearbyFacilities, getDemoFacilities, FACILITY_DB } = require('../data/medicalFacilities');
const { fetchNearbyFacilitiesOSM } = require('./overpass');

function findNearbyHospitals(lat, lng, limit = 15, maxKm = 800) {
  return findNearbyFacilities(lat, lng, { limit, maxKm });
}

const LIVE_ENABLED = process.env.DISABLE_LIVE_HOSPITALS !== '1';

/** Short-lived per-client cache so bookings can validate against the last shown list. */
const facilityCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;

function rememberFacilities(key, facilities) {
  if (!key) return;
  facilityCache.set(key, { facilities, ts: Date.now() });
}

function recallFacilities(key) {
  if (!key) return null;
  const hit = facilityCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > CACHE_TTL_MS) {
    facilityCache.delete(key);
    return null;
  }
  return hit.facilities;
}

/** Deduplicate curated + live facilities that describe the same place (name/proximity). */
function mergeFacilities(curated, live) {
  const out = [...curated];
  const norm = (s) => (s || '').toLowerCase().replace(/[\s·・,，.。()（）]/g, '');
  for (const l of live) {
    const dup = out.some((c) => {
      const closeName = norm(c.name) && norm(l.name)
        && (norm(c.name).includes(norm(l.name)) || norm(l.name).includes(norm(c.name)));
      const closeGeo = typeof c.lat === 'number' && Math.abs(c.lat - l.lat) < 0.003 && Math.abs(c.lng - l.lng) < 0.003;
      return closeName || closeGeo;
    });
    if (!dup) out.push(l);
  }
  return out.sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));
}

/**
 * Real-mode nearby search. Combines the curated licensed catalog (rich Chinese
 * licence data) with live worldwide OpenStreetMap facilities so both domestic
 * and international, locally-recognised institutions are returned.
 *
 * @param {{lat:number,lng:number,country?:string,city?:string,ip?:string}} location
 * @param {object} [opts]
 * @param {number} [opts.limit=30]
 * @param {number} [opts.radiusKm=40]
 * @param {string} [opts.type]
 * @returns {Promise<{facilities:Array,source:string}>}
 */
async function findNearbyHospitalsLive(location, opts = {}) {
  const { lat, lng, country, city } = location || {};
  const { limit = 30, radiusKm = 40, type = null } = opts;

  const curated = findNearbyFacilities(lat, lng, { limit: 40, maxKm: radiusKm });

  let live = [];
  if (LIVE_ENABLED) {
    try {
      live = await fetchNearbyFacilitiesOSM(lat, lng, { radiusKm, limit: 60, country, city });
    } catch {
      live = [];
    }
  }

  let facilities;
  let source;
  if (live.length) {
    facilities = mergeFacilities(curated, live);
    source = curated.length ? 'merged' : 'openstreetmap';
  } else {
    facilities = curated;
    source = 'catalog';
  }

  if (type) facilities = facilities.filter((f) => f.type === type);
  facilities = facilities.slice(0, limit);

  return { facilities, source };
}

module.exports = {
  HOSPITAL_DB: FACILITY_DB,
  findNearbyHospitals,
  findNearbyHospitalsLive,
  getDemoFacilities,
  rememberFacilities,
  recallFacilities,
};
