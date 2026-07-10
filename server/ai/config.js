const fs = require('fs');
const path = require('path');
const { encrypt, decrypt } = require('../security/crypto');
const { getProvider, resolveApiKeyFromEnv, listProviders } = require('./providers');

const CONFIG_FILE = path.join(__dirname, '../../data/ai-config.json');

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
    return decrypt(payload);
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

function getProviderKeys(saved) {
  return migrateLegacy({ ...saved }).providerKeys || {};
}

function providerKeyConfigured(providerId, providerKeys) {
  const pk = providerKeys[providerId];
  return Boolean(resolveApiKeyFromEnv(providerId) || pk?.apiKeyEncrypted);
}

function loadConfig() {
  const saved = migrateLegacy(readFile());
  const providerKeys = saved.providerKeys || {};
  const activeId = saved.provider || DEFAULT.provider;
  const active = getProvider(activeId);
  const activeEntry = providerKeys[activeId] || {};
  const model = activeEntry.model || saved.model || process.env.OPENAI_MODEL || active.defaultModel;
  // Always use the active provider's endpoint — stale baseUrl from another provider breaks API calls.
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
  };
}

function saveConfig(partial) {
  const dir = path.dirname(CONFIG_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const current = migrateLegacy(readFile());
  const providerId = partial.provider || current.provider || DEFAULT.provider;
  const provider = getProvider(providerId);
  const providerKeys = { ...(current.providerKeys || {}) };
  const entry = { ...(providerKeys[providerId] || {}) };

  if (partial.model) entry.model = partial.model;
  if (partial.apiKey) entry.apiKeyEncrypted = encrypt(partial.apiKey);

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
  return loadConfig();
}

function getApiKey() {
  const saved = migrateLegacy(readFile());
  const providerId = saved.provider || DEFAULT.provider;
  const envKey = resolveApiKeyFromEnv(providerId);
  if (envKey) return envKey;
  const pk = saved.providerKeys?.[providerId];
  if (pk?.apiKeyEncrypted) return decryptApiKey(pk.apiKeyEncrypted);
  return '';
}

function isAiConfigured() {
  return Boolean(getApiKey());
}

module.exports = { loadConfig, saveConfig, getApiKey, isAiConfigured, CONFIG_FILE };
