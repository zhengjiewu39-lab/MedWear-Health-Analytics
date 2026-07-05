const crypto = require('crypto');
const { audit } = require('./audit');
const { maskToken } = require('./crypto');

const IS_PROD = process.env.NODE_ENV === 'production';
const ALLOW_DEMO = !IS_PROD || process.env.ALLOW_DEMO_AUTH === 'true';
const JWT_SECRET = process.env.MEDWEAR_JWT_SECRET || (ALLOW_DEMO ? 'medwear-jwt-dev-only' : null);
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

if (IS_PROD && !process.env.MEDWEAR_JWT_SECRET) {
  console.error('[security] MEDWEAR_JWT_SECRET is required when NODE_ENV=production');
  process.exit(1);
}

function getUsers() {
  if (process.env.MEDWEAR_USERS_JSON) {
    return JSON.parse(process.env.MEDWEAR_USERS_JSON);
  }
  if (!ALLOW_DEMO) return {};
  return {
    admin: {
      password: process.env.MEDWEAR_ADMIN_PASSWORD || 'admin123',
      user: { id: 1, username: 'admin', name: '管理员', role: 'admin' },
    },
    demo: {
      password: process.env.MEDWEAR_DEMO_PASSWORD || 'demo123',
      user: { id: 2, username: 'demo', name: '演示用户', role: 'user' },
    },
  };
}

function signToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Date.now() + TOKEN_TTL_MS;
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function verifyToken(token) {
  if (!token || !JWT_SECRET) return null;
  const parts = token.replace(/^Bearer\s+/i, '').split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  if (sig !== expected) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
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

function isPublicPath(path) {
  return [
    '/api/health',
    '/api/auth/login',
    '/api/auth/logout',
    '/api/platform/status',
  ].includes(path);
}

function authMiddleware(req, res, next) {
  if (!req.path.startsWith('/api/') || isPublicPath(req.path)) return next();

  if (req.path.startsWith('/api/platform/v1')) {
    const apiKey = req.headers['x-api-key'];
    if (apiKey && validateApiKey(apiKey)) {
      req.user = { username: 'platform', role: 'integration', apiKey: maskToken(apiKey) };
      return next();
    }
    return res.status(401).json({ success: false, message: '无效 API Key' });
  }

  const user = verifyToken(req.headers.authorization);
  if (!user) {
    return res.status(401).json({ success: false, message: '未授权，请先登录' });
  }
  req.user = user;
  return next();
}

function authenticate(username, password) {
  const account = getUsers()[username];
  if (account && account.password === password) {
    return { user: account.user, token: signToken(account.user) };
  }
  return null;
}

module.exports = {
  signToken,
  verifyToken,
  authMiddleware,
  authenticate,
  validateApiKey,
  getApiKeys,
  getUsers,
  isPublicPath,
  ALLOW_DEMO,
  IS_PROD,
  API_KEYS,
};
