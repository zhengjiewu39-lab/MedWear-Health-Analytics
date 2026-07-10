/**
 * Live worldwide medical-facility discovery via the OpenStreetMap Overpass API.
 *
 * Overpass is a free, key-less, global read API over OSM data. We query for
 * recognised healthcare facilities (hospitals, clinics, doctors, medical
 * centres, laboratories) around a coordinate and normalise the results into
 * the facility schema used by the exam-booking UI.
 *
 * Note: OSM does not carry statutory licence numbers, so for each facility we
 * attach a `qualification` descriptor derived from the facility category plus
 * the competent health authority for the country (see REGULATORS). This is an
 * honest representation of "locally-recognised" institutions rather than a
 * fabricated licence number.
 *
 * @module server/geo/overpass
 */

const { haversineKm } = require('./location');

const OVERPASS_ENDPOINTS = [
  process.env.OVERPASS_API_URL,
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
].filter(Boolean);

/** Health authority per country (competent regulator for medical institutions). */
const REGULATORS = {
  '中国': { zh: '国家/地方卫生健康委员会', en: 'National/Local Health Commission' },
  'China': { zh: '国家/地方卫生健康委员会', en: 'National/Local Health Commission' },
  'United States': { zh: '州卫生署 / The Joint Commission', en: 'State Dept. of Health / The Joint Commission' },
  'United Kingdom': { zh: '医疗质量委员会 (CQC)', en: 'Care Quality Commission (CQC)' },
  'Japan': { zh: '厚生劳动省', en: 'Ministry of Health, Labour and Welfare' },
  '日本': { zh: '厚生劳动省', en: 'Ministry of Health, Labour and Welfare' },
  'Singapore': { zh: '卫生部 (MOH)', en: 'Ministry of Health (MOH)' },
  'Germany': { zh: '联邦州卫生主管部门', en: 'State Health Authority' },
  'France': { zh: '地区卫生署 (ARS)', en: 'Regional Health Agency (ARS)' },
  'Australia': { zh: 'AHPRA', en: 'AHPRA' },
  'Canada': { zh: '省卫生厅', en: 'Provincial Ministry of Health' },
};

const DEFAULT_REGULATOR = { zh: '当地卫生主管部门', en: 'Local health authority' };

/** OSM tag → internal facility type. */
function classify(tags = {}) {
  const amenity = tags.amenity;
  const healthcare = tags.healthcare;
  const name = `${tags.name || ''} ${tags['name:en'] || ''} ${tags['name:zh'] || ''}`.toLowerCase();
  const speciality = (tags['healthcare:speciality'] || '').toLowerCase();

  const looksLikeCheckup = /体检|健康管理|health\s?check|check[-\s]?up|medical\s?exam|screening|preventive/.test(name)
    || /occupational|preventive|check_up|screening/.test(speciality);

  if (amenity === 'hospital' || healthcare === 'hospital') return 'hospital';
  if (healthcare === 'laboratory' || amenity === 'laboratory') return 'lab';
  if (looksLikeCheckup) return 'checkup';
  if (amenity === 'clinic' || healthcare === 'clinic') return 'clinic';
  if (amenity === 'doctors' || healthcare === 'doctor' || healthcare === 'centre') return 'clinic';
  return null;
}

function buildAddress(tags = {}, fallbackCity = '') {
  const parts = [
    tags['addr:full'],
    [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' '),
    tags['addr:district'],
    tags['addr:city'] || tags['addr:town'],
    tags['addr:state'] || tags['addr:province'],
    tags['addr:country'],
  ].filter(Boolean);
  const addr = Array.from(new Set(parts)).join(', ');
  return addr || fallbackCity || '';
}

function facilityName(tags = {}, type, isZh) {
  const name = tags.name || (isZh ? tags['name:zh'] : tags['name:en']) || tags['name:en'] || tags['name:zh'];
  if (name) return name;
  const generic = {
    hospital: isZh ? '医院' : 'Hospital',
    checkup: isZh ? '体检中心' : 'Health Checkup Center',
    clinic: isZh ? '门诊/诊所' : 'Clinic',
    lab: isZh ? '医学检验机构' : 'Medical Laboratory',
  };
  return generic[type] || (isZh ? '医疗机构' : 'Medical facility');
}

function levelLabel(tags = {}, type, isZh) {
  const opType = tags['operator:type'];
  if (opType === 'public' || opType === 'government') return isZh ? '公立' : 'Public';
  if (opType === 'private') return isZh ? '私立' : 'Private';
  if (tags.emergency === 'yes') return isZh ? '含急诊' : 'Emergency';
  const byType = {
    hospital: isZh ? '综合医院' : 'Hospital',
    checkup: isZh ? '体检机构' : 'Checkup center',
    clinic: isZh ? '门诊/诊所' : 'Clinic',
    lab: isZh ? '检验机构' : 'Laboratory',
  };
  return byType[type] || '';
}

function departments(tags = {}) {
  const raw = tags['healthcare:speciality'] || tags['department'] || '';
  if (!raw) return [];
  return raw.split(';').map((s) => s.replace(/_/g, ' ').trim()).filter(Boolean).slice(0, 6);
}

/**
 * Build the Overpass QL query for healthcare POIs around a point.
 * @param {number} lat
 * @param {number} lng
 * @param {number} radiusM
 * @returns {string}
 */
function buildQuery(lat, lng, radiusM) {
  const r = Math.round(radiusM);
  return `[out:json][timeout:25];
(
  nwr["amenity"~"^(hospital|clinic|doctors)$"](around:${r},${lat},${lng});
  nwr["healthcare"~"^(hospital|clinic|centre|laboratory|doctor)$"](around:${r},${lat},${lng});
);
out center 250;`;
}

/** Short-lived cache keyed by rounded coordinate + radius to avoid re-hitting mirrors. */
const queryCache = new Map();
const QUERY_TTL_MS = 15 * 60 * 1000;

function cacheKey(lat, lng, radiusM) {
  return `${lat.toFixed(2)}:${lng.toFixed(2)}:${Math.round(radiusM / 1000)}`;
}

/**
 * POST a query to the Overpass mirrors, trying each until one returns valid
 * JSON. Public mirrors are frequently rate-limited (429) or overloaded (504)
 * and may return HTML error pages, so every response is validated as JSON.
 * @param {string} query
 * @returns {Promise<Array>}
 */
async function runOverpass(query) {
  const perTimeout = Number(process.env.OVERPASS_TIMEOUT_MS) || 12000;
  let lastErr = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'MedWear-HealthAnalytics/1.0 (exam-booking facility search)',
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(perTimeout),
      });
      if (!res.ok) { lastErr = new Error(`Overpass ${res.status} @ ${endpoint}`); continue; }
      const text = await res.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        lastErr = new Error(`Overpass non-JSON @ ${endpoint}`);
        continue;
      }
      if (Array.isArray(json.elements)) return json.elements;
      lastErr = new Error(`Overpass no elements @ ${endpoint}`);
    } catch (err) {
      lastErr = err;
    }
  }
  if (lastErr) throw lastErr;
  return [];
}

/**
 * Fetch and normalise nearby medical facilities from OpenStreetMap.
 * @param {number} lat
 * @param {number} lng
 * @param {object} [opts]
 * @param {number} [opts.radiusKm=40]
 * @param {number} [opts.limit=30]
 * @param {string} [opts.country]
 * @param {string} [opts.city]
 * @returns {Promise<Array<object>>}
 */
async function fetchNearbyFacilitiesOSM(lat, lng, opts = {}) {
  const { radiusKm = 40, limit = 30, country = '', city = '' } = opts;
  if (typeof lat !== 'number' || typeof lng !== 'number') return [];

  const isZh = /中国|China|香港|澳门|台湾|Hong Kong|Macau|Taiwan/i.test(country) || !country;
  const regulator = REGULATORS[country] || DEFAULT_REGULATOR;

  const radiusM = radiusKm * 1000;
  const key = cacheKey(lat, lng, radiusM);
  const cached = queryCache.get(key);
  let elements;
  if (cached && Date.now() - cached.ts < QUERY_TTL_MS) {
    elements = cached.elements;
  } else {
    elements = await runOverpass(buildQuery(lat, lng, radiusM));
    queryCache.set(key, { elements, ts: Date.now() });
  }

  const seen = new Set();
  const facilities = [];
  for (const el of elements) {
    const tags = el.tags || {};
    const type = classify(tags);
    if (!type) continue;

    const fLat = el.lat ?? el.center?.lat;
    const fLng = el.lon ?? el.center?.lon;
    if (typeof fLat !== 'number' || typeof fLng !== 'number') continue;

    const name = facilityName(tags, type, isZh);
    const dedupeKey = `${name}|${fLat.toFixed(3)}|${fLng.toFixed(3)}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const distanceKm = +haversineKm(lat, lng, fLat, fLng).toFixed(1);
    const typeLabelZh = { hospital: '医院', checkup: '体检中心', clinic: '门诊部', lab: '医学检验机构' }[type];

    facilities.push({
      id: `osm-${el.type}-${el.id}`,
      source: 'openstreetmap',
      type,
      typeLabel: typeLabelZh,
      name,
      level: levelLabel(tags, type, isZh),
      address: buildAddress(tags, city),
      lat: fLat,
      lng: fLng,
      phone: tags.phone || tags['contact:phone'] || '',
      website: tags.website || tags['contact:website'] || '',
      departments: departments(tags),
      country: country || tags['addr:country'] || '',
      distanceKm,
      distance: distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm} km`,
      // Qualification descriptor (no statutory licence number available from OSM).
      verified: false,
      qualification: {
        category: typeLabelZh,
        authority: isZh ? regulator.zh : regulator.en,
        registry: 'OpenStreetMap',
        note: isZh
          ? '基于 OpenStreetMap 公开医疗机构分类，执业许可证请到院核验'
          : 'Based on OpenStreetMap healthcare classification; verify the operating licence on site',
      },
    });
  }

  return facilities
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}

module.exports = {
  fetchNearbyFacilitiesOSM,
  REGULATORS,
  classify,
};
