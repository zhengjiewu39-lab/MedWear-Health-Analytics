function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  const ip = req.ip || req.connection?.remoteAddress || '';
  if (ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1') {
    try {
      const r = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(4000) });
      const j = await r.json();
      return j.ip;
    } catch {
      return null;
    }
  }
  return ip.replace('::ffff:', '');
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
    country: process.env.MEDWEAR_GEO_COUNTRY || '',
    ip: 'env',
    source: 'env',
  };
}

async function fetchIpApiCo(ip) {
  try {
    const url = ip ? `https://ipapi.co/${encodeURIComponent(ip)}/json/` : 'https://ipapi.co/json/';
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
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
      ip: data.ip,
      source: 'ipapi.co',
    };
  } catch {
    return null;
  }
}

async function fetchIpApiCom(ip) {
  if (!ip) return null;
  try {
    const url = `http://ip-api.com/json/${encodeURIComponent(ip)}?lang=en&fields=status,message,country,regionName,city,lat,lon,query`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    if (data.status !== 'success') return null;
    return {
      lat: data.lat,
      lng: data.lon,
      city: data.city,
      region: data.regionName,
      country: data.country,
      ip: data.query,
      source: 'ip-api',
    };
  } catch {
    return null;
  }
}

/** Ensure lat/lng exist for downstream facility search. */
function withSearchCoords(location) {
  if (location?.lat != null && location?.lng != null) return location;
  return {
    ...location,
    lat: 52.4068,
    lng: -1.5197,
    city: location?.city || 'Coventry',
    region: location?.region || 'England',
    country: location?.country || 'United Kingdom',
    source: `${location?.source || 'unknown'}-coords-fallback`,
  };
}

async function geolocate(req) {
  const envLoc = envGeoOverride();
  if (envLoc) return envLoc;

  const ip = await getClientIp(req);

  let loc = await fetchIpApiCo(ip);
  if (!loc && ip) loc = await fetchIpApiCo(null);
  if (!loc && ip) loc = await fetchIpApiCom(ip);

  if (loc) return loc;

  return {
    lat: null,
    lng: null,
    city: null,
    region: null,
    country: null,
    ip: ip || 'unknown',
    source: 'unavailable',
    message: 'IP geolocation failed. Set MEDWEAR_GEO_LAT, MEDWEAR_GEO_LNG (and optional MEDWEAR_GEO_CITY) in .env',
  };
}

module.exports = { geolocate, haversineKm, getClientIp, withSearchCoords, envGeoOverride };
