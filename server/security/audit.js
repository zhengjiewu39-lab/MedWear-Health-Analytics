const fs = require('fs');
const path = require('path');
const { maskToken } = require('./crypto');

const AUDIT_FILE = path.join(__dirname, '../../data/audit-log.json');
const MAX_ENTRIES = 500;

function ensureFile() {
  const dir = path.dirname(AUDIT_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(AUDIT_FILE)) fs.writeFileSync(AUDIT_FILE, '[]');
}

function readLog() {
  ensureFile();
  try {
    return JSON.parse(fs.readFileSync(AUDIT_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeLog(entries) {
  ensureFile();
  fs.writeFileSync(AUDIT_FILE, JSON.stringify(entries.slice(0, MAX_ENTRIES), null, 2));
}

function audit(action, meta = {}) {
  const entry = {
    id: Date.now().toString(36),
    timestamp: new Date().toISOString(),
    action,
    ip: meta.ip || 'local',
    user: meta.user || 'anonymous',
    resource: meta.resource || '',
    success: meta.success !== false,
    detail: meta.detail || '',
  };
  const log = readLog();
  log.unshift(entry);
  writeLog(log);
  return entry;
}

function auditMiddleware(req, res, next) {
  const sensitive = ['/api/auth/login', '/api/platform', '/api/data', '/api/appointments'];
  const match = sensitive.some(p => req.path.startsWith(p));
  if (match && ['POST', 'PUT', 'DELETE'].includes(req.method)) {
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      audit(`${req.method} ${req.path}`, {
        ip: req.ip,
        user: req.user?.username || 'anonymous',
        resource: req.path,
        success: res.statusCode < 400,
        detail: req.path.includes('login') ? 'auth attempt' : '',
      });
      return originalJson(body);
    };
  }
  next();
}

function getAuditLog(limit = 50) {
  return readLog().slice(0, limit);
}

module.exports = { audit, auditMiddleware, getAuditLog, maskToken };
