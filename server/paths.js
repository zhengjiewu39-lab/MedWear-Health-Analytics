'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

function getAppRoot() {
  return path.join(__dirname, '..');
}

/** 桌面版与 npm run app 共用 ~/.medwear，避免 AI 配置丢失 */
function getDefaultUserDataRoot() {
  return path.join(os.homedir(), '.medwear');
}

function getUserBase() {
  return process.env.MEDWEAR_DATA_DIR || process.env.MEDWEAR_USER_DATA || null;
}

function getDataDir() {
  const base = getUserBase();
  if (base) return path.join(base, 'medwear-data');
  return path.join(getAppRoot(), 'data');
}

function getImportDir() {
  const base = getUserBase();
  if (base) return path.join(base, 'health-import');
  return path.join(getAppRoot(), 'health-import');
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function ensureDataDir() {
  return ensureDir(getDataDir());
}

function ensureImportDir() {
  return ensureDir(getImportDir());
}

module.exports = {
  getAppRoot,
  getDefaultUserDataRoot,
  getDataDir,
  getImportDir,
  ensureDataDir,
  ensureImportDir,
};
