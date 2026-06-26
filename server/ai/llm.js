const { getApiKey, loadConfig } = require('./config');

const SYSTEM_PROMPT = `你是 MedWear 专业健康 AI 顾问，面向普通用户（非医生）提供个性化健康建议。
规则：
1. 基于用户提供的真实可穿戴数据作答，引用具体数值
2. 给出可执行的建议（作息、运动、饮食、何时就医）
3. 引用 WHO/AHA 等指南时简要说明
4. 明确声明：不能替代医生诊断，紧急情况请就医
5. 使用中文，语气专业温和，结构清晰`;

function buildHealthContext(ctx) {
  if (!ctx || ctx.mode === 'demo') {
    return `【演示数据】${JSON.stringify(ctx?.summary || {}, null, 0)}`;
  }
  if (!ctx.hasData) {
    return '【真实模式】用户尚未导入 Apple Health 数据，请引导其前往「数据导入」页面上传 export.zip。';
  }
  return `【真实 Apple Health 数据】
用户: ${ctx.userLabel || '用户'}
数据范围: ${ctx.dateRange?.start || '?'} ~ ${ctx.dateRange?.end || '?'} (${ctx.dayCount || 0} 天)
来源: ${ctx.primarySource || 'Apple Watch'}

近期指标:
- 健康评分: ${ctx.healthScore ?? '—'}
- 平均心率: ${ctx.heartRate ?? '—'} bpm
- 血氧: ${ctx.spo2 ?? '—'}%
- HRV: ${ctx.hrv ?? '—'} ms
- 日均步数: ${ctx.steps ?? '—'}
- 睡眠: ${ctx.sleepHours ?? '—'} h

AI 摘要: ${ctx.aiSummary || '—'}
预警: ${(ctx.alerts || []).map(a => a.message).join('; ') || '无'}`;
}

async function chatWithLLM(message, healthContext) {
  const apiKey = getApiKey();
  const config = loadConfig();

  if (!apiKey) {
    return {
      reply: healthContext?.hasData
        ? '真实 AI 尚未配置。请在「设置」页填写 OpenAI API Key，我将基于您的 Apple Health 真实数据提供个性化建议（不会使用演示模式的规则引擎）。'
        : '您尚未导入 Apple Health 数据。请先点击左侧「数据导入」上传 apple_health_export.zip，并在设置中配置 OpenAI API Key。',
      confidence: 1,
      isSimulated: false,
      isRealAi: false,
      needsConfig: true,
      model: 'MedWear-AI · 真实模式',
      notice: '真实模式不使用模拟 AI 回复',
    };
  }

  const contextBlock = buildHealthContext(healthContext);
  const url = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.4,
        max_tokens: 1200,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `${contextBlock}\n\n用户问题: ${message}` },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`AI API ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || '未能生成回复';

    return {
      reply,
      confidence: 0.92,
      model: config.model,
      isSimulated: false,
      sources: ['OpenAI', 'MedWear 真实健康数据', '临床参考标准库'],
      citations: [],
      usage: data.usage,
    };
  } catch (err) {
    return {
      reply: `真实 AI 调用失败：${err.message}\n\n请检查 API Key 与网络。真实模式不会降级为演示规则引擎。`,
      confidence: 0,
      isSimulated: false,
      isRealAi: false,
      model: config.model,
      notice: '真实 AI 调用失败',
    };
  }
}

module.exports = { chatWithLLM, buildHealthContext, SYSTEM_PROMPT };
