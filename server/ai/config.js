const fs = require('fs');
const path = require('path');
const { encrypt, decryptAny } = require('../security/crypto');
const { getProvider, resolveApiKeyFromEnv, listProviders } = require('./providers');
const { getDataDir, ensureDataDir } = require('../paths');

const CONFIG_FILE = path.join(getDataDir(), 'ai-config.json');

const DEFAULT = {
  provider: 'openai',
  model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  baseUrl: null,
  apiKeySet: false,
};

function readFile() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
  } catch { /* ignore */ }
  return {};
}

function decryptApiKey(payload) {
  try {
    const { value } = decryptAny(payload);
    return typeof value === 'string' ? value.trim() : '';
  } catch {
    return '';
  }
}

function migrateLegacy(saved) {
  if (saved.apiKeyEncrypted && !saved.providerKeys) {
    const pid = saved.provider || DEFAULT.provider;
    saved.providerKeys = {
      [pid]: {
        apiKeyEncrypted: saved.apiKeyEncrypted,
        model: saved.model,
      },
    };
    delete saved.apiKeyEncrypted;
  }
  return saved;
}

/** 旧密钥解密成功后，用当前密钥重新加密并写回 */
function reencryptLegacyKeys(saved) {
  const providerKeys = saved.providerKeys || {};
  let changed = false;
  Object.entries(providerKeys).forEach(([pid, entry]) => {
    if (!entry?.apiKeyEncrypted) return;
    try {
      const { value, usedLegacy } = decryptAny(entry.apiKeyEncrypted);
      if (usedLegacy && typeof value === 'string' && value.trim()) {
        providerKeys[pid] = { ...entry, apiKeyEncrypted: encrypt(value.trim()) };
        changed = true;
      }
    } catch { /* ignore */ }
  });
  if (!changed) return saved;
  const next = { ...saved, providerKeys };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2));
  return next;
}

function resolveStoredApiKey(providerId, providerKeys) {
  const envKey = resolveApiKeyFromEnv(providerId);
  if (envKey) return envKey.trim();
  const pk = providerKeys[providerId];
  if (!pk?.apiKeyEncrypted) return '';
  return decryptApiKey(pk.apiKeyEncrypted);
}

function providerKeyConfigured(providerId, providerKeys) {
  return Boolean(resolveStoredApiKey(providerId, providerKeys));
}

function loadConfig() {
  const saved = reencryptLegacyKeys(migrateLegacy(readFile()));
  const providerKeys = saved.providerKeys || {};
  const activeId = saved.provider || DEFAULT.provider;
  const active = getProvider(activeId);
  const activeEntry = providerKeys[activeId] || {};
  const model = activeEntry.model || saved.model || process.env.OPENAI_MODEL || active.defaultModel;
  const baseUrl = active.baseUrl;

  const availableProviders = listProviders().map((p) => ({
    ...p,
    apiKeySet: providerKeyConfigured(p.id, providerKeys),
    selectedModel: providerKeys[p.id]?.model || p.defaultModel,
    isActive: p.id === activeId,
  }));

  return {
    provider: activeId,
    providerLabel: active.label,
    model,
    baseUrl,
    apiKeySet: providerKeyConfigured(activeId, providerKeys),
    format: active.format,
    availableProviders,
    configPath: CONFIG_FILE,
  };
}

function saveConfig(partial) {
  ensureDataDir();
  const current = migrateLegacy(readFile());
  const providerId = partial.provider || current.provider || DEFAULT.provider;
  const providerKeys = { ...(current.providerKeys || {}) };
  const entry = { ...(providerKeys[providerId] || {}) };

  if (partial.model) entry.model = partial.model;
  if (partial.apiKey) entry.apiKeyEncrypted = encrypt(String(partial.apiKey).trim());

  providerKeys[providerId] = entry;

  const setActive = partial.setActive !== false;
  const activeId = setActive ? providerId : (current.provider || providerId);
  const payload = {
    provider: activeId,
    model: providerKeys[activeId]?.model || partial.model || getProvider(activeId).defaultModel,
    baseUrl: getProvider(activeId).baseUrl,
    providerKeys,
    apiKeySet: providerKeyConfigured(activeId, providerKeys),
  };

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(payload, null, 2));

  if (partial.apiKey && !resolveStoredApiKey(activeId, providerKeys)) {
    throw new Error('API Key 已写入但无法解密读取。请重启应用后重试，或使用环境变量 DEEPSEEK_API_KEY。');
  }

  return loadConfig();
}

function getApiKey() {
  const saved = migrateLegacy(readFile());
  const providerId = saved.provider || DEFAULT.provider;
  return resolveStoredApiKey(providerId, saved.providerKeys || {});
}

function isAiConfigured() {
  return Boolean(getApiKey());
}

module.exports = {
  loadConfig, saveConfig, getApiKey, isAiConfigured, CONFIG_FILE, resolveStoredApiKey,
};
