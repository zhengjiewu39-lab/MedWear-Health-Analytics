/**
 * Sanitize facility websites — drop wrong/social/unrelated URLs so the UI
 * falls back to an official-site search instead of opening a bad link.
 */

const BAD_HOST_PARTS = [
  'facebook.com', 'twitter.com', 'x.com', 'instagram.com', 'weibo.com',
  'youtube.com', 'tiktok.com', 'linkedin.com', 'wikipedia.org', 'baidu.com',
  'google.com', 'goo.gl', 'bit.ly', 't.co', 'apps.apple.com', 'play.google.com',
  'yelp.com', 'tripadvisor', 'booking.com', 'opentable',
];

function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

function nameTokens(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/医院|体检|中心|医疗|门诊|诊所|检验|health|hospital|clinic|medical|centre|center/g, ' ')
    .split(/[^a-z0-9\u4e00-\u9fff]+/)
    .filter((t) => t.length >= 2);
}

/**
 * Keep website only when it looks like an official site possibly related to the name.
 * @returns {string|''}
 */
function sanitizeFacilityWebsite(name, website) {
  if (!website || typeof website !== 'string') return '';
  let url = website.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  let host;
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    host = u.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
  if (!host || host.includes(' ')) return '';
  if (BAD_HOST_PARTS.some((b) => host.includes(b))) return '';

  const tokens = nameTokens(name);
  const hostCompact = host.replace(/[^a-z0-9\u4e00-\u9fff]/g, '');
  // Chinese curated sites often use acronym domains unrelated to Chinese chars — allow known TLDs.
  const trustedTld = /\.(cn|com|org|edu|gov|nhs\.uk|nhs\.uk|ac\.uk|co\.uk)$/i.test(host)
    || host.endsWith('.nhs.uk');
  if (tokens.length === 0) return trustedTld ? url : '';

  const related = tokens.some((t) => {
    if (/[\u4e00-\u9fff]/.test(t)) return false; // Chinese tokens rarely appear in domain
    return hostCompact.includes(t) || t.includes(hostCompact.slice(0, 6));
  });
  // Keep hospital/checkup brand domains even if token match is weak (curated + OSM hospital sites).
  if (related || trustedTld) return url;
  return '';
}

function bookingSearchUrl(facility) {
  const q = [facility.name, facility.address, facility.city || facility.country, '官网 预约 体检']
    .filter(Boolean)
    .join(' ');
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

module.exports = { sanitizeFacilityWebsite, bookingSearchUrl, hostnameOf };
