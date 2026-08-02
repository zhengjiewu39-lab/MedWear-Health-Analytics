const { findNearbyFacilities, getDemoFacilities, FACILITY_DB } = require('../data/medicalFacilities');
const { fetchNearbyFacilitiesOSM } = require('./overpass');
const { sanitizeFacilityWebsite } = require('./website');

const MAX_SEARCH_RADIUS_KM = 100;

function findNearbyHospitals(lat, lng, limit = 15, maxKm = MAX_SEARCH_RADIUS_KM) {
  return findNearbyFacilities(lat, lng, { limit, maxKm: Math.min(maxKm, MAX_SEARCH_RADIUS_KM) });
}

const LIVE_ENABLED = process.env.DISABLE_LIVE_HOSPITALS !== '1';

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

function withTimeout(promise, ms, fallback) {
  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        resolve(fallback);
      }
    }, ms);
    promise.then((value) => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        resolve(value);
      }
    }).catch(() => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        resolve(fallback);
      }
    });
  });
}

function polishFacilities(list) {
  return (list || []).map((f) => {
    const website = sanitizeFacilityWebsite(f.name, f.website);
    return { ...f, website };
  }).filter((f) => f.name && f.type);
}

/**
 * Progressive nearby search for both demo and real modes.
 * Expands OSM + catalog radius until enough checkup-relevant facilities are found.
 */
async function findNearbyHospitalsLive(location, opts = {}) {
  const { lat, lng, country, city } = location || {};
  const { limit = 30, radiusKm = 40, type = null, minResults = 6 } = opts;

  // Search radius may expand up to 100 km, never beyond.
  const requested = Math.min(MAX_SEARCH_RADIUS_KM, Math.max(Number(radiusKm) || 40, 1));
  let usedRadius = requested;
  let live = [];
  let source = 'catalog';

  const osmBudget = Number(process.env.OVERPASS_BUDGET_MS) || 7000;

  async function searchAt(radius) {
    const curated = findNearbyFacilities(lat, lng, { limit: 40, maxKm: radius });
    let osm = [];
    if (LIVE_ENABLED && typeof lat === 'number' && typeof lng === 'number') {
      osm = await withTimeout(
        fetchNearbyFacilitiesOSM(lat, lng, { radiusKm: radius, limit: 80, country, city }),
        osmBudget,
        [],
      );
    }
    let list = osm.length ? mergeFacilities(curated, osm) : curated;
    list = polishFacilities(list)
      .filter((f) => (f.distanceKm ?? 9999) <= radius)
      .filter((f) => (!type || f.type === type));
    return {
      list,
      source: osm.length ? (curated.length ? 'merged' : 'openstreetmap') : 'catalog',
    };
  }

  let { list: facilities, source: src } = await searchAt(usedRadius);
  source = src;

  // Expand once to the 100 km cap if too few results.
  if (facilities.length < minResults && usedRadius < MAX_SEARCH_RADIUS_KM) {
    usedRadius = MAX_SEARCH_RADIUS_KM;
    ({ list: facilities, source: src } = await searchAt(usedRadius));
    source = src;
  }

  facilities = facilities.slice(0, limit);
  const nearbyCount = facilities.length;
  return {
    facilities,
    source,
    searchRadiusKm: usedRadius,
    nearbyCount,
    expanded: usedRadius > requested,
    maxRadiusKm: MAX_SEARCH_RADIUS_KM,
  };
}

module.exports = {
  HOSPITAL_DB: FACILITY_DB,
  findNearbyHospitals,
  findNearbyHospitalsLive,
  getDemoFacilities,
  rememberFacilities,
  recallFacilities,
};
