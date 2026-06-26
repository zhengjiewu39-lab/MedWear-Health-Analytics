const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '../../data/ai-config.json');

const DEFAULT = {
  provider: 'openai',
  model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  apiKeySet: Boolean(process.env.OPENAI_API_KEY),
};

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      return { ...DEFAULT, ...saved, apiKeySet: Boolean(process.env.OPENAI_API_KEY || saved.apiKey) };
    }
  } catch { /* ignore */ }
  return { ...DEFAULT };
}

function saveConfig(partial) {
  const dir = path.dirname(CONFIG_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const current = loadConfig();
  const next = { ...current, ...partial };
  if (partial.apiKey) {
    process.env.OPENAI_API_KEY = partial.apiKey;
    next.apiKeySet = true;
    delete next.apiKey;
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({
    provider: next.provider,
    model: next.model,
    baseUrl: next.baseUrl,
    apiKeySet: next.apiKeySet,
  }, null, 2));
  return next;
}

function getApiKey() {
  return process.env.OPENAI_API_KEY || '';
}

function isAiConfigured() {
  return Boolean(getApiKey());
}

module.exports = { loadConfig, saveConfig, getApiKey, isAiConfigured, CONFIG_FILE };
