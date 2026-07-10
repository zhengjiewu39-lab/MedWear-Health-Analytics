const { getApiKey, loadConfig } = require('./config');
const { getProvider } = require('./providers');

const SYSTEM_PROMPT = `你是 MedWear 专业健康 AI 顾问，基于平台提供的真实数据上下文作答。
规则：
1. 仅根据上下文中的数据回答，无数据时明确说明，不得编造检查结果
2. 给出可执行建议，引用具体数值
3. 不能替代医生诊断
4. 使用中文，语气专业清晰`;

const DOCTOR_SYSTEM_PROMPT = `你是 MedWear 临床 AI 助手，服务对象为执业医师与医疗管理者。

职责：
1. 解读可穿戴代理信号、异常检测、预测分析、临床筛查与干预队列数据
2. 协助医师制定随访、加查、转诊与干预决策
3. 引用上下文中的具体数值与风险分层，不得编造未提供的检验/影像结果
4. 明确：AI 建议仅供参考，临床决策权在医师
5. 可讨论论文队列（n=5000 筛查 vs 对照）的方法学与效应量
6. 回答简洁、结构化，优先给出临床可执行要点`;

function buildHealthContext(ctx) {
  if (!ctx) return '【MedWear】无上下文';
  if (ctx.mode === 'demo' || !ctx.hasData) {
    const modeLabel = ctx.mode === 'demo' ? '演示模式' : '真实模式（尚未导入个人 Apple Health）';
    return `【${modeLabel}】\n摘要: ${JSON.stringify(ctx.summary || {}, null, 0)}`;
  }
  return `【真实 Apple Health 数据】
用户: ${ctx.userLabel || '用户'}
数据范围: ${ctx.dateRange?.start || '?'} ~ ${ctx.dateRange?.end || '?'} (${ctx.dayCount || 0} 天)
健康评分: ${ctx.healthScore ?? '—'} · 心率: ${ctx.heartRate ?? '—'} · 血氧: ${ctx.spo2 ?? '—'}%
HRV: ${ctx.hrv ?? '—'} · 步数: ${ctx.steps ?? '—'} · 睡眠: ${ctx.sleepHours ?? '—'} h
预警: ${(ctx.alerts || []).map((a) => a.message).join('; ') || '无'}`;
}

async function chatOpenAI({ apiKey, baseUrl, model, messages }) {
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, temperature: 0.35, max_tokens: 2000, messages }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`AI API ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data = await res.json();
  return {
    reply: data.choices?.[0]?.message?.content || '未能生成回复',
    usage: data.usage,
    model,
  };
}

async function chatAnthropic({ apiKey, baseUrl, model, system, messages }) {
  const url = `${baseUrl.replace(/\/$/, '')}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model, max_tokens: 2000, system, messages }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Claude API ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data = await res.json();
  const text = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
  return { reply: text || '未能生成回复', usage: data.usage, model };
}

/**
 * Real LLM only — no simulated fallback.
 * @param {string} message
 * @param {object} options - healthContext (legacy), systemPrompt, history, contextBlock
 */
async function chatWithLLM(message, options = {}) {
  const apiKey = getApiKey();
  const config = loadConfig();
  const provider = getProvider(config.provider);
  const systemPrompt = options.systemPrompt || SYSTEM_PROMPT;
  const history = options.history || [];
  const contextBlock = options.contextBlock
    || (options.healthContext || options.mode ? buildHealthContext(options.healthContext || options) : '【MedWear】');

  if (!apiKey) {
    return {
      reply: null,
      needsConfig: true,
      error: 'AI 未配置',
      model: `${provider.label} · 未配置`,
    };
  }

  const userContent = `${contextBlock}\n\n${message}`;

  try {
    const baseUrl = config.baseUrl || provider.baseUrl;
    const model = config.model || provider.defaultModel;

    if (provider.format === 'anthropic') {
      const messages = [
        ...history.filter((m) => m.role === 'user' || m.role === 'assistant'),
        { role: 'user', content: userContent },
      ];
      const result = await chatAnthropic({ apiKey, baseUrl, model, system: systemPrompt, messages });
      return {
        reply: result.reply,
        model: `${provider.label} / ${result.model}`,
        provider: provider.id,
        isRealAi: true,
        usage: result.usage,
      };
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.filter((m) => m.role === 'user' || m.role === 'assistant'),
      { role: 'user', content: userContent },
    ];
    const result = await chatOpenAI({ apiKey, baseUrl, model, messages });
    return {
      reply: result.reply,
      model: `${provider.label} / ${result.model}`,
      provider: provider.id,
      isRealAi: true,
      usage: result.usage,
    };
  } catch (err) {
    return {
      reply: null,
      error: err.message,
      model: config.model,
      provider: provider.id,
      isRealAi: false,
    };
  }
}

module.exports = {
  chatWithLLM, buildHealthContext, SYSTEM_PROMPT, DOCTOR_SYSTEM_PROMPT,
};
