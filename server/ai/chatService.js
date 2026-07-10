const { chatWithLLM, DOCTOR_SYSTEM_PROMPT } = require('./llm');
const { buildClinicalContext, formatContextForLLM } = require('./contextBuilder');
const { isAiConfigured, loadConfig } = require('./config');

async function doctorChat({ message, history = [] }, provider, dataMode) {
  if (!isAiConfigured()) {
    return {
      success: false,
      needsConfig: true,
      reply: null,
      message: '请先在「系统设置」配置 AI 提供商（OpenAI / DeepSeek / Gemini / Grok / Claude）及 API Key。',
    };
  }

  const ctx = buildClinicalContext(provider, dataMode);
  const contextBlock = formatContextForLLM(ctx);

  const result = await chatWithLLM(message, {
    systemPrompt: DOCTOR_SYSTEM_PROMPT,
    history: history.slice(-20),
    contextBlock,
  });

  if (result.needsConfig || result.error) {
    return {
      success: false,
      needsConfig: result.needsConfig,
      error: result.error,
      message: result.error || 'AI 调用失败',
      reply: result.reply,
      model: result.model,
    };
  }

  return {
    success: true,
    reply: result.reply,
    model: result.model,
    provider: result.provider,
    usage: result.usage,
    contextSummary: {
      mode: ctx.mode,
      hasPersonalData: ctx.hasPersonalData,
      anomalyCount: ctx.anomalies.length,
      pendingInterventions: ctx.interventions.pending,
    },
  };
}

function getChatStatus() {
  const config = loadConfig();
  return {
    configured: isAiConfigured(),
    provider: config.provider,
    providerLabel: config.providerLabel,
    model: config.model,
  };
}

module.exports = { doctorChat, getChatStatus };
