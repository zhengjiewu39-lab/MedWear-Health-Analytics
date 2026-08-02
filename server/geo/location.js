function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalizeIp(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let ip = raw.trim().replace(/^\[|\]$/g, '');
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  // Drop port if present (rare)
  if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(ip)) ip = ip.split(':')[0];
  return ip;
}

function isValidPublicIp(ip) {
  const n = normalizeIp(ip);
  if (!n) return false;
  if (isLoopbackOrPrivate(n)) return false;
  // Basic IPv4 / IPv6 shape
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(n)) return true;
  if (n.includes(':')) return true;
  return false;
}

function isLoopbackOrPrivate(ip) {
  const n = normalizeIp(ip);
  if (!n) return true;
  if (n === '::1' || n === '127.0.0.1' || n === '0.0.0.0' || n === 'localhost') return true;
  if (/^10\./.test(n)) return true;
  if (/^192\.168\./.test(n)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(n)) return true;
  if (/^100\.(6[4-9]|[7-9]\d|1[0-2]\d)\./.test(n)) return true; // CGNAT
  if (/^fc/i.test(n) || /^fd/i.test(n) || /^fe80:/i.test(n)) return true;
  return false;
}

function pickClientIp(req) {
  const candidates = [];
  // Prefer explicit client-reported public IP (from browser) — most accurate for localhost/Electron.
  const qIp = normalizeIp(req.query?.clientIp || req.headers['x-medwear-client-ip']);
  if (qIp) candidates.push(qIp);

  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    for (const part of String(forwarded).split(',')) {
      candidates.push(normalizeIp(part));
    }
  }
  const realIp = req.headers['x-real-ip'];
  if (realIp) candidates.push(normalizeIp(realIp));
  candidates.push(normalizeIp(req.ip));
  candidates.push(normalizeIp(req.socket?.remoteAddress));
  candidates.push(normalizeIp(req.connection?.remoteAddress));

  for (const ip of candidates) {
    if (isValidPublicIp(ip)) return ip;
  }
  return candidates.find(Boolean) || '';
}

async function resolvePublicIp() {
  const endpoints = [
    { url: 'https://api.ipify.org?format=json', parse: async (res) => (await res.json()).ip },
    { url: 'https://api64.ipify.org?format=json', parse: async (res) => (await res.json()).ip },
    { url: 'https://ipv4.icanhazip.com', parse: async (res) => (await res.text()).trim() },
    { url: 'https://ipwho.is/', parse: async (res) => { const j = await res.json(); return j.success ? j.ip : null; } },
  ];
  for (const ep of endpoints) {
    try {
      const res = await fetch(ep.url, {
        signal: AbortSignal.timeout(2500),
        headers: { Accept: 'application/json,text/plain,*/*', 'User-Agent': 'MedWear/1.0' },
      });
      if (!res.ok) continue;
      const ip = normalizeIp(await ep.parse(res));
      if (isValidPublicIp(ip)) return ip;
    } catch {
      /* next */
    }
  }
  return null;
}

async function getClientIp(req) {
  const local = pickClientIp(req);
  if (isValidPublicIp(local)) return local;
  return (await resolvePublicIp()) || local || null;
}

function envGeoOverride() {
  const lat = parseFloat(process.env.MEDWEAR_GEO_LAT);
  const lng = parseFloat(process.env.MEDWEAR_GEO_LNG);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    lat,
    lng,
    city: process.env.MEDWEAR_GEO_CITY || '',
    region: process.env.MEDWEAR_GEO_REGION || '',
    country: process.env.MEDWEAR_GEO_COUNTRY || 'China',
    ip: process.env.MEDWEAR_GEO_IP || 'env',
    source: 'env',
  };
}

function parseClientCoords(req) {
  const lat = parseFloat(req.query?.lat ?? req.headers['x-medwear-lat']);
  const lng = parseFloat(req.query?.lng ?? req.headers['x-medwear-lng']);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

async function fetchIpApiCom(ip) {
  if (!ip) return null;
  try {
    const url = `http://ip-api.com/json/${encodeURIComponent(ip)}?lang=zh-CN&fields=status,message,country,regionName,city,lat,lon,query`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
    const data = await res.json();
    if (data.status !== 'success') return null;
    return {
      lat: data.lat,
      lng: data.lon,
      city: data.city,
      region: data.regionName,
      country: data.country,
      ip: data.query || ip,
      source: 'ip-api',
    };
  } catch {
    return null;
  }
}

async function fetchIpWhoIs(ip) {
  try {
    const path = ip ? `https://ipwho.is/${encodeURIComponent(ip)}` : 'https://ipwho.is/';
    const res = await fetch(path, {
      signal: AbortSignal.timeout(3500),
      headers: { 'User-Agent': 'MedWear-Health-Analytics/1.0' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.success || data.latitude == null || data.longitude == null) return null;
    return {
      lat: data.latitude,
      lng: data.longitude,
      city: data.city,
      region: data.region,
      country: data.country,
      ip: data.ip || ip,
      source: 'ipwho.is',
    };
  } catch {
    return null;
  }
}

async function fetchIpApiCo(ip) {
  try {
    const url = ip ? `https://ipapi.co/${encodeURIComponent(ip)}/json/` : 'https://ipapi.co/json/';
    const res = await fetch(url, {
      signal: AbortSignal.timeout(3500),
      headers: { 'User-Agent': 'MedWear-Health-Analytics/1.0' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.error || data.latitude == null || data.longitude == null) return null;
    return {
      lat: data.latitude,
      lng: data.longitude,
      city: data.city,
      region: data.region,
      country: data.country_name,
      ip: data.ip || ip,
      source: 'ipapi.co',
    };
  } catch {
    return null;
  }
}

async function fetchIpSb(ip) {
  try {
    const url = ip ? `https://api.ip.sb/geoip/${encodeURIComponent(ip)}` : 'https://api.ip.sb/geoip';
    const res = await fetch(url, {
      signal: AbortSignal.timeout(3500),
      headers: { 'User-Agent': 'MedWear-Health-Analytics/1.0', Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.latitude == null || data.longitude == null) return null;
    return {
      lat: data.latitude,
      lng: data.longitude,
      city: data.city,
      region: data.region || data.region_code,
      country: data.country || data.country_code,
      ip: data.ip || ip,
      source: 'ip.sb',
    };
  } catch {
    return null;
  }
}

/** Collect multiple providers and pick a consensus (median coords + majority city). */
async function consensusGeo(ip) {
  const results = (await Promise.all([
    fetchIpApiCom(ip),
    fetchIpWhoIs(ip),
    fetchIpSb(ip),
    fetchIpApiCo(ip),
  ])).filter(Boolean);

  if (!results.length) return null;

  // Prefer results whose returned IP matches the queried IP (avoids egress mismatch).
  const matched = results.filter((r) => !ip || !r.ip || normalizeIp(r.ip) === normalizeIp(ip));
  const pool = matched.length ? matched : results;

  const lats = pool.map((r) => r.lat).sort((a, b) => a - b);
  const lngs = pool.map((r) => r.lng).sort((a, b) => a - b);
  const mid = Math.floor(pool.length / 2);
  const lat = pool.length % 2 ? lats[mid] : (lats[mid - 1] + lats[mid]) / 2;
  const lng = pool.length % 2 ? lngs[mid] : (lngs[mid - 1] + lngs[mid]) / 2;

  // Closest sample to median for city/region labels
  let best = pool[0];
  let bestD = Infinity;
  for (const r of pool) {
    const d = Math.abs(r.lat - lat) + Math.abs(r.lng - lng);
    if (d < bestD) { bestD = d; best = r; }
  }

  return {
    lat,
    lng,
    city: best.city,
    region: best.region,
    country: best.country,
    ip: best.ip || ip,
    source: pool.length > 1 ? `consensus:${pool.map((r) => r.source).join('+')}` : best.source,
    providers: pool.map((r) => r.source),
  };
}

async function reverseGeocode(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=zh-CN,en`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(4000),
      headers: { 'User-Agent': 'MedWear-Health-Analytics/1.0' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const a = data.address || {};
    return {
      city: a.city || a.town || a.municipality || a.county || a.village || '',
      region: a.state || a.province || a.region || '',
      country: a.country || '',
    };
  } catch {
    return null;
  }
}

const GEO_CACHE = new Map();
const GEO_CACHE_TTL_MS = 5 * 60 * 1000;

function cacheGet(key) {
  const hit = GEO_CACHE.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > GEO_CACHE_TTL_MS) {
    GEO_CACHE.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(key, value) {
  if (!key) return;
  GEO_CACHE.set(key, { value, ts: Date.now() });
}

const DEFAULT_FALLBACK = {
  lat: 39.9042,
  lng: 116.4074,
  city: '北京',
  region: '北京市',
  country: 'China',
};

function withSearchCoords(location) {
  if (location?.lat != null && location?.lng != null) return location;
  return {
    ...DEFAULT_FALLBACK,
    ...location,
    lat: DEFAULT_FALLBACK.lat,
    lng: DEFAULT_FALLBACK.lng,
    city: location?.city || DEFAULT_FALLBACK.city,
    region: location?.region || DEFAULT_FALLBACK.region,
    country: location?.country || DEFAULT_FALLBACK.country,
    source: `${location?.source || 'unknown'}-coords-fallback`,
    fallback: true,
  };
}

/**
 * Realtime geolocation for exam booking.
 * Priority: env override → browser GPS (+ reverse geo) → client/public IP consensus.
 */
async function geolocate(req) {
  const envLoc = envGeoOverride();
  if (envLoc) return envLoc;

  const ip = await getClientIp(req);
  const gps = parseClientCoords(req);

  // Always resolve IP city in parallel for display even when GPS is present.
  const cacheKey = `ip:${ip || 'unknown'}`;
  let ipLoc = cacheGet(cacheKey);
  const ipPromise = ipLoc
    ? Promise.resolve(ipLoc)
    : consensusGeo(ip).then((loc) => {
      if (loc) {
        if (ip && !loc.ip) loc.ip = ip;
        cacheSet(cacheKey, loc);
      }
      return loc;
    });

  if (gps) {
    const [place, ipResult] = await Promise.all([reverseGeocode(gps.lat, gps.lng), ipPromise]);
    return {
      lat: gps.lat,
      lng: gps.lng,
      city: place?.city || ipResult?.city || '',
      region: place?.region || ipResult?.region || '',
      country: place?.country || ipResult?.country || '',
      ip: (ipResult?.ip && isValidPublicIp(ipResult.ip) ? ipResult.ip : ip) || 'unknown',
      source: 'browser-gps',
      ipSource: ipResult?.source || null,
      ipCity: ipResult?.city || null,
      accuracy: parseFloat(req.query?.accuracy) || undefined,
    };
  }

  const loc = await ipPromise;
  if (loc) return loc;

  return {
    lat: null,
    lng: null,
    city: null,
    region: null,
    country: null,
    ip: ip || 'unknown',
    source: 'unavailable',
    message: 'IP 定位失败。可在 .env 设置 MEDWEAR_GEO_LAT / MEDWEAR_GEO_LNG / MEDWEAR_GEO_CITY，或允许浏览器定位',
  };
}

module.exports = {
  geolocate,
  haversineKm,
  getClientIp,
  withSearchCoords,
  envGeoOverride,
  isLoopbackOrPrivate,
  normalizeIp,
  isValidPublicIp,
  parseClientCoords,
};
