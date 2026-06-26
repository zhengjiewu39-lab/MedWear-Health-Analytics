const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
const VAULT_FILE = path.join(DATA_DIR, 'health-vault.enc');
const AUDIT_FILE = path.join(DATA_DIR, 'audit-log.json');

const ALGO = 'aes-256-gcm';
const KEY = crypto.scryptSync(
  process.env.MEDWEAR_SECRET || 'medwear-demo-secret-change-in-production',
  'medwear-salt-v1',
  32
);

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function encrypt(plaintext) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { iv: iv.toString('hex'), tag: tag.toString('hex'), data: enc.toString('hex') };
}

function decrypt(payload) {
  const iv = Buffer.from(payload.iv, 'hex');
  const tag = Buffer.from(payload.tag, 'hex');
  const data = Buffer.from(payload.data, 'hex');
  const decipher = crypto.createDecipheriv(ALGO, KEY, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(dec.toString('utf8'));
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
  encrypt, decrypt, saveVault, loadVault, hashSensitive, anonymizeProfile, maskToken, ALGO,
};
