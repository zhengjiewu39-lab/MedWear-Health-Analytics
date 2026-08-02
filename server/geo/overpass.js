/**
 * Live worldwide medical-facility discovery via the OpenStreetMap Overpass API.
 *
 * Overpass is a free, key-less, global read API over OSM data. We query for
 * recognised healthcare facilities (hospitals, clinics, doctors, medical
 * centres, laboratories) around a coordinate and normalise the results into
 * the facility schema used by the exam-booking UI.
 *
 * @module server/geo/overpass
 */

const { haversineKm } = require('./location');
const { sanitizeFacilityWebsite } = require('./website');

const OVERPASS_ENDPOINTS = [
  process.env.OVERPASS_API_URL,
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
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

/** Exclude non medical-checkup noise commonly mistagged in OSM. */
function isExcluded(tags = {}, name = '') {
  const amenity = tags.amenity || '';
  const healthcare = tags.healthcare || '';
  const n = name.toLowerCase();
  if (/veterinary|animal|宠物|动物|牙科|齿科|dental|dentist|药店|pharmacy|opti[ck]|眼科配镜|美容|cosmetic|plastic|整形|养生|spa|按摩|massage|养老|nursing|psychiatric|精神病|戒毒|rehab/.test(n)) {
    return true;
  }
  if (['veterinary', 'dentist', 'pharmacy', 'nursing_home', 'social_facility'].includes(amenity)) return true;
  if (['dentist', 'pharmacy', 'veterinary', 'nurse', 'physiotherapist', 'alternative', 'optometrist'].includes(healthcare)) {
    return true;
  }
  return false;
}

/**
 * OSM tag → internal facility type.
 * Only keep institutions suitable for medical checkup booking:
 * hospitals, checkup / health-management centres, medical labs, and larger clinics.
 * Solo GPs / random doctors are excluded.
 */
function classify(tags = {}) {
  const amenity = tags.amenity;
  const healthcare = tags.healthcare;
  const name = `${tags.name || ''} ${tags['name:en'] || ''} ${tags['name:zh'] || ''}`;
  const nameL = name.toLowerCase();
  const speciality = (tags['healthcare:speciality'] || '').toLowerCase();

  if (!tags.name && !tags['name:en'] && !tags['name:zh']) return null;
  if (isExcluded(tags, name)) return null;

  const looksLikeCheckup = /体检|健康管理|健康检查|health\s?check|check[-\s]?up|medical\s?exam|screening|preventive|occupational\s?health|wellness\s?centre|wellness\s?center/.test(nameL)
    || /occupational|preventive|check_up|screening/.test(speciality);
  const looksLikeHospital = /医院|hospital|infirmary|medical\s?center|medical\s?centre|nhs\s?trust|university\s?hospital|综合医院|人民医院|中心医院/.test(nameL);
  const looksLikeLab = /检验|检查|实验室|laboratory|patholog|诊断中心|diagnostic/.test(nameL);

  if (amenity === 'hospital' || healthcare === 'hospital' || looksLikeHospital) return 'hospital';
  if (looksLikeCheckup) return 'checkup';
  if (healthcare === 'laboratory' || looksLikeLab) return 'lab';
  // Clinics only when they look like medical / checkup institutions (not beauty/solo GP).
  if ((amenity === 'clinic' || healthcare === 'clinic' || healthcare === 'centre')
    && /医院|门诊|医疗|clinic|medical|health|hospital|体检/.test(nameL)
    && !/美容|dental|牙|宠物/.test(nameL)) {
    return 'clinic';
  }
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

function buildQuery(lat, lng, radiusM) {
  const r = Math.round(radiusM);
  // Prefer hospitals / labs / clinics — exclude amenity=doctors (solo GP noise).
  return `[out:json][timeout:12];
(
  nwr["amenity"="hospital"](around:${r},${lat},${lng});
  nwr["amenity"="clinic"](around:${r},${lat},${lng});
  nwr["healthcare"="hospital"](around:${r},${lat},${lng});
  nwr["healthcare"="clinic"](around:${r},${lat},${lng});
  nwr["healthcare"="centre"](around:${r},${lat},${lng});
  nwr["healthcare"="laboratory"](around:${r},${lat},${lng});
  nwr["name"~"体检|健康管理|Health Check|Check[- ]?up|Medical Centre|Medical Center|Hospital",i](around:${r},${lat},${lng});
);
out center 200;`;
}

const queryCache = new Map();
const QUERY_TTL_MS = 15 * 60 * 1000;

function cacheKey(lat, lng, radiusM) {
  return `${lat.toFixed(2)}:${lng.toFixed(2)}:${Math.round(radiusM / 1000)}`;
}

/**
 * Race Overpass mirrors in parallel — first valid JSON wins.
 * Previously tried endpoints sequentially (up to ~60s), which hung the booking page.
 */
async function runOverpass(query) {
  const perTimeout = Number(process.env.OVERPASS_TIMEOUT_MS) || 6000;
  const overallTimeout = Number(process.env.OVERPASS_OVERALL_MS) || 8000;

  const attempts = OVERPASS_ENDPOINTS.map(async (endpoint) => {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'MedWear-HealthAnalytics/1.0 (exam-booking facility search)',
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(perTimeout),
    });
    if (!res.ok) throw new Error(`Overpass ${res.status} @ ${endpoint}`);
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`Overpass non-JSON @ ${endpoint}`);
    }
    if (!Array.isArray(json.elements)) throw new Error(`Overpass no elements @ ${endpoint}`);
    return json.elements;
  });

  return new Promise((resolve, reject) => {
    let rejected = 0;
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error('Overpass overall timeout'));
      }
    }, overallTimeout);

    for (const p of attempts) {
      p.then((elements) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(elements);
      }).catch(() => {
        rejected += 1;
        if (!settled && rejected === attempts.length) {
          settled = true;
          clearTimeout(timer);
          reject(new Error('All Overpass mirrors failed'));
        }
      });
    }
  });
}

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
    // Skip nameless / generic placeholders
    if (!name || /^(医院|hospital|clinic|医疗机构|medical facility)$/i.test(name.trim())) continue;

    const dedupeKey = `${name}|${fLat.toFixed(3)}|${fLng.toFixed(3)}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const distanceKm = +haversineKm(lat, lng, fLat, fLng).toFixed(1);
    const typeLabelZh = { hospital: '医院', checkup: '体检中心', clinic: '门诊部', lab: '医学检验机构' }[type];
    const rawWebsite = tags.website || tags['contact:website'] || tags['contact:website:en'] || '';
    const website = sanitizeFacilityWebsite(name, rawWebsite);

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
      website,
      departments: departments(tags),
      country: country || tags['addr:country'] || '',
      distanceKm,
      distance: distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm} km`,
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
