const crypto = require('crypto');

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_FAILURES = 8;
const loginAttempts = new Map();

function clientIp(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function isLoginLocked(ip) {
  const entry = loginAttempts.get(ip);
  if (!entry) return false;
  if (Date.now() - entry.firstAt > LOGIN_WINDOW_MS) {
    loginAttempts.delete(ip);
    return false;
  }
  return entry.count >= MAX_LOGIN_FAILURES;
}

function recordLoginFailure(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip) || { count: 0, firstAt: now };
  if (now - entry.firstAt > LOGIN_WINDOW_MS) {
    entry.count = 0;
    entry.firstAt = now;
  }
  entry.count += 1;
  loginAttempts.set(ip, entry);
}

function clearLoginFailures(ip) {
  loginAttempts.delete(ip);
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(input, stored) {
  if (!stored || !input) return false;
  if (stored.startsWith('scrypt:')) {
    const [, salt, hash] = stored.split(':');
    const derived = crypto.scryptSync(input, salt, 64).toString('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(derived, 'hex'), Buffer.from(hash, 'hex'));
    } catch {
      return false;
    }
  }
  try {
    return crypto.timingSafeEqual(Buffer.from(input), Buffer.from(stored));
  } catch {
    return false;
  }
}

function requestIdMiddleware(req, res, next) {
  const id = req.headers['x-request-id'] || crypto.randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}

function securityHeadersMiddleware(_req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  next();
}

module.exports = {
  isLoginLocked,
  recordLoginFailure,
  clearLoginFailures,
  hashPassword,
  verifyPassword,
  requestIdMiddleware,
  securityHeadersMiddleware,
  MAX_LOGIN_FAILURES,
};
