/**
 * Client-side realtime location helpers for exam booking.
 * Prefer browser GPS for nearby search; always resolve public IP for display.
 */

async function fetchJson(url, timeoutMs = 4000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url, timeoutMs = 4000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.text()).trim();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Resolve the browser machine's public IP (not 127.0.0.1). */
export async function getClientPublicIp() {
  const tries = [
    async () => {
      const j = await fetchJson('https://api.ipify.org?format=json');
      return j?.ip || null;
    },
    async () => {
      const j = await fetchJson('https://api64.ipify.org?format=json');
      return j?.ip || null;
    },
    async () => {
      const t = await fetchText('https://ipv4.icanhazip.com');
      return t && /^\d+\.\d+\.\d+\.\d+$/.test(t) ? t : null;
    },
    async () => {
      const j = await fetchJson('https://ipwho.is/');
      return j?.success ? j.ip : null;
    },
  ];
  for (const run of tries) {
    try {
      const ip = await run();
      if (ip) return ip;
    } catch {
      /* next */
    }
  }
  return null;
}

/** Optional browser GPS (more accurate for "nearby" than IP city centroid). */
export function getBrowserPosition(timeoutMs = 8000) {
  return new Promise((resolve) => {
    if (!navigator?.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          source: 'browser-gps',
        });
      },
      () => resolve(null),
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 60_000 },
    );
  });
}

/**
 * Collect client geo hints to send with /api/hospitals.
 * GPS (if allowed) + public IP — both modes use realtime location.
 */
export async function collectClientGeo() {
  const [gps, ip] = await Promise.all([
    getBrowserPosition(7000),
    getClientPublicIp(),
  ]);
  return {
    clientIp: ip || undefined,
    lat: gps?.lat,
    lng: gps?.lng,
    accuracy: gps?.accuracy,
    gpsSource: gps?.source,
  };
}

export default collectClientGeo;
