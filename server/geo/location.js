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
      const r = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(3000) });
      const j = await r.json();
      return j.ip;
    } catch {
      return null;
    }
  }
  return ip.replace('::ffff:', '');
}

async function geolocate(req) {
  const ip = await getClientIp(req);
  if (!ip) {
    return { lat: 39.9042, lng: 116.4074, city: '北京', region: '北京', country: '中国', source: 'default', ip: 'local' };
  }
  try {
    const url = `http://ip-api.com/json/${ip}?lang=zh-CN&fields=status,message,country,regionName,city,lat,lon,query`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    if (data.status === 'success') {
      return {
        lat: data.lat,
        lng: data.lon,
        city: data.city,
        region: data.regionName,
        country: data.country,
        ip: data.query,
        source: 'ip-api',
      };
    }
  } catch { /* fallback */ }
  return { lat: 39.9042, lng: 116.4074, city: '北京', region: '北京', country: '中国', source: 'fallback', ip };
}

module.exports = { geolocate, haversineKm, getClientIp };
