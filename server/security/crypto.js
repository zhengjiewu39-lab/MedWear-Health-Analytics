const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { getDataDir, ensureDataDir } = require('../paths');

const DATA_DIR = getDataDir();
const VAULT_FILE = path.join(DATA_DIR, 'health-vault.enc');

const IS_PROD = process.env.NODE_ENV === 'production';
const ALLOW_DEMO = !IS_PROD || process.env.ALLOW_DEMO_AUTH === 'true';
/** 本地演示/桌面版统一密钥，避免 dev 与 desktop 加密不一致导致 API Key 无法解密 */
const LOCAL_STORAGE_KEY = 'medwear-unified-local-encryption-v1';
const SECRET = process.env.MEDWEAR_ENCRYPTION_KEY || process.env.MEDWEAR_SECRET
  || (ALLOW_DEMO ? LOCAL_STORAGE_KEY : null);

/** 旧版桌面/开发密钥 — 仅用于解密历史 ai-config，新写入统一用 SECRET */
const LEGACY_SECRETS = [
  'medwear-desktop-encryption-key-32chars!!',
  'medwear-demo-secret-change-in-production',
];

function deriveKey(secret) {
  return crypto.scryptSync(secret, 'medwear-salt-v1', 32);
}

const ALGO = 'aes-256-gcm';
const KEY = deriveKey(SECRET || 'missing-key');

if (IS_PROD && !SECRET && !ALLOW_DEMO) {
  console.error('[security] MEDWEAR_ENCRYPTION_KEY is required when NODE_ENV=production');
  process.exit(1);
}

function encrypt(plaintext) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { iv: iv.toString('hex'), tag: tag.toString('hex'), data: enc.toString('hex') };
}

function decryptWithKey(payload, key) {
  const iv = Buffer.from(payload.iv, 'hex');
  const tag = Buffer.from(payload.tag, 'hex');
  const data = Buffer.from(payload.data, 'hex');
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(dec.toString('utf8'));
}

function decrypt(payload) {
  return decryptWithKey(payload, KEY);
}

/** 兼容旧版加密配置，返回 { value, usedLegacy } */
function decryptAny(payload) {
  const candidates = [
    SECRET || LOCAL_STORAGE_KEY,
    ...LEGACY_SECRETS,
  ].filter(Boolean);
  const unique = [...new Set(candidates)];
  for (let i = 0; i < unique.length; i += 1) {
    try {
      const value = decryptWithKey(payload, deriveKey(unique[i]));
      return { value, usedLegacy: i > 0 || unique[i] !== (SECRET || LOCAL_STORAGE_KEY) };
    } catch { /* try next */ }
  }
  throw new Error('decrypt failed');
}

function saveVault(record) {
  ensureDataDir();
  const payload = encrypt(record);
  fs.writeFileSync(VAULT_FILE, JSON.stringify(payload, null, 2));
  return { saved: true, algorithm: ALGO, keyDerivation: 'scrypt' };
}

function loadVault() {
  if (!fs.existsSync(VAULT_FILE)) return null;
  return decrypt(JSON.parse(fs.readFileSync(VAULT_FILE, 'utf8')));
}

function hashSensitive(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
}

function anonymizeProfile(profile) {
  return {
    ...profile,
    name: profile.name ? profile.name[0] + '**' : '***',
    phone: profile.phone ? profile.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : undefined,
    id: hashSensitive(profile.id || profile.name),
  };
}

function maskToken(token) {
  if (!token || token.length < 8) return '***';
  return token.slice(0, 4) + '****' + token.slice(-4);
}

module.exports = {
  encrypt, decrypt, decryptAny, saveVault, loadVault, hashSensitive, anonymizeProfile, maskToken, ALGO,
};
