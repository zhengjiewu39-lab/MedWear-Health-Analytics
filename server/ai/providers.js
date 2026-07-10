/**
 * Supported LLM providers — OpenAI-compatible where possible.
 */

const PROVIDERS = {
  openai: {
    id: 'openai',
    label: 'OpenAI',
    label_en: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'o3-mini'],
    format: 'openai',
    envKey: 'OPENAI_API_KEY',
  },
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    label_en: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    format: 'openai',
    envKey: 'DEEPSEEK_API_KEY',
  },
  gemini: {
    id: 'gemini',
    label: 'Google Gemini',
    label_en: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.0-flash',
    models: ['gemini-2.0-flash', 'gemini-2.5-flash-preview', 'gemini-1.5-pro'],
    format: 'openai',
    envKey: 'GEMINI_API_KEY',
  },
  grok: {
    id: 'grok',
    label: 'xAI Grok',
    label_en: 'xAI Grok',
    baseUrl: 'https://api.x.ai/v1',
    defaultModel: 'grok-2-latest',
    models: ['grok-2-latest', 'grok-3-mini'],
    format: 'openai',
    envKey: 'GROK_API_KEY',
  },
  claude: {
    id: 'claude',
    label: 'Anthropic Claude',
    label_en: 'Anthropic Claude',
    baseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-5-sonnet-latest',
    models: ['claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest', 'claude-sonnet-4-20250514'],
    format: 'anthropic',
    envKey: 'ANTHROPIC_API_KEY',
  },
};

function listProviders() {
  return Object.values(PROVIDERS).map((p) => ({
    id: p.id,
    label: p.label,
    label_en: p.label_en,
    baseUrl: p.baseUrl,
    defaultModel: p.defaultModel,
    models: p.models,
    format: p.format,
  }));
}

function getProvider(id) {
  return PROVIDERS[id] || PROVIDERS.openai;
}

function resolveApiKeyFromEnv(providerId) {
  const p = getProvider(providerId);
  if (process.env[p.envKey]) return process.env[p.envKey];
  if (providerId === 'openai' && process.env.MEDWEAR_AI_API_KEY) return process.env.MEDWEAR_AI_API_KEY;
  return '';
}

module.exports = { PROVIDERS, listProviders, getProvider, resolveApiKeyFromEnv };
