const crypto = require('crypto');
const { audit } = require('./audit');
const { maskToken } = require('./crypto');

const JWT_SECRET = process.env.MEDWEAR_JWT_SECRET || 'medwear-jwt-demo-secret';
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function signToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Date.now() + TOKEN_TTL_MS;
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  const sig = crypto.createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function verifyToken(token) {
  if (!token) return null;
  const parts = token.replace(/^Bearer\s+/i, '').split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expected = crypto.createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`).digest('base64url');
  if (sig !== expected) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function authMiddleware(req, res, next) {
  const publicPaths = ['/api/auth/login', '/api/auth/logout', '/api/platform/status'];
  if (publicPaths.some(p => req.path === p)) return next();
  const token = req.headers.authorization;
  const user = verifyToken(token);
  if (!user && req.path.startsWith('/api/platform/v1')) {
    const apiKey = req.headers['x-api-key'];
    if (apiKey && validateApiKey(apiKey)) {
      req.user = { username: 'platform', role: 'integration', apiKey: maskToken(apiKey) };
      return next();
    }
    return res.status(401).json({ success: false, message: '无效 API Key' });
  }
  if (user) req.user = user;
  next();
}

const API_KEYS = new Map([
  ['mw_demo_hospital_001', { name: '北京协和医院', scopes: ['read:vitals', 'read:screening', 'read:report'] }],
  ['mw_demo_insurance_002', { name: '平安健康', scopes: ['read:screening'] }],
]);

function validateApiKey(key) {
  return API_KEYS.has(key);
}

function getApiKeys() {
  return [...API_KEYS.entries()].map(([key, meta]) => ({
    key: maskToken(key),
    name: meta.name,
    scopes: meta.scopes,
  }));
}

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cache-Control', 'no-store');
  next();
}

module.exports = {
  signToken, verifyToken, authMiddleware, securityHeaders,
  validateApiKey, getApiKeys, API_KEYS,
};
