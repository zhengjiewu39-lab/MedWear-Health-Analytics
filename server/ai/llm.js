const https = require('https');
const dns = require('dns');
const { getApiKey, loadConfig } = require('./config');
const { getProvider } = require('./providers');

try {
  dns.setDefaultResultOrder('ipv4first');
} catch { /* Node < 17 */ }

const LLM_TIMEOUT_MS = Number(process.env.MEDWEAR_LLM_TIMEOUT_MS || 120000);
const LLM_RETRIES = Number(process.env.MEDWEAR_LLM_RETRIES || 2);

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

function mapLlmError(err, providerLabel) {
  const code = err.code || '';
  const msg = err.message || '';
  const status = err.status;
  const body = err.body || '';

  if (status === 401 || status === 403) {
    return `API Key 无效（${providerLabel}）— 请在 DeepSeek 控制台重新生成 Key`;
  }
  if (status === 402 || /insufficient|balance|quota/i.test(body)) {
    return 'DeepSeek 账户余额不足，请前往 platform.deepseek.com 充值';
  }
  if (status === 404 || /model.*not found/i.test(body)) {
    return '模型不可用，请在设置中改用 deepseek-chat';
  }
  if (status >= 400) {
    return `DeepSeek API ${status}: ${String(body).slice(0, 200)}`;
  }
  if (/timeout/i.test(code + msg)) {
    return `连接 DeepSeek 超时，请稍后重试`;
  }
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN|network|EPROTO|CERT/i.test(code + msg)) {
    return `无法连接 DeepSeek（${code || msg}）— 请检查网络或换手机热点`;
  }
  return msg || 'AI 调用失败';
}

function resolveHostV4(hostname) {
  return new Promise((resolve, reject) => {
    dns.lookup(hostname, { family: 4, hints: dns.ADDRCONFIG }, (err, address) => {
      if (err) reject(err);
      else resolve(address);
    });
  });
}

function httpsPostJson(url, headers, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const u = new URL(url);
    resolveHostV4(u.hostname)
      .then((address) => {
        const req = https.request(
          {
            host: address,
            servername: u.hostname,
            port: 443,
            path: `${u.pathname}${u.search}`,
            method: 'POST',
            family: 4,
            headers: { ...headers, 'Content-Length': Buffer.byteLength(body), Host: u.hostname },
            timeout: LLM_TIMEOUT_MS,
          },
          (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
              let parsed = data;
              try { parsed = JSON.parse(data); } catch { /* string */ }
              resolve({ status: res.statusCode || 0, data: parsed, raw: data });
            });
          },
        );
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })); });
        req.write(body);
        req.end();
      })
      .catch(reject);
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function postWithRetry(url, headers, payload) {
  let lastErr;
  for (let i = 0; i <= LLM_RETRIES; i += 1) {
    try {
      const res = await httpsPostJson(url, headers, payload);
      if (res.status < 400) return res;
      const err = Object.assign(new Error(`HTTP ${res.status}`), {
        status: res.status,
        body: res.raw,
      });
      throw err;
    } catch (err) {
      lastErr = err;
      if (i < LLM_RETRIES && /fetch failed|ECONNRESET|ETIMEDOUT|timeout|EAI_AGAIN|ENOTFOUND/i.test(`${err.code} ${err.message}`)) {
        await sleep(800 * (i + 1));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

async function chatOpenAI({ apiKey, baseUrl, model, messages }) {
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  const res = await postWithRetry(
    url,
    { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    { model, temperature: 0.35, max_tokens: 2000, messages },
  );
  return {
    reply: res.data.choices?.[0]?.message?.content || '未能生成回复',
    usage: res.data.usage,
    model,
  };
}

async function chatAnthropic({ apiKey, baseUrl, model, system, messages }) {
  const url = `${baseUrl.replace(/\/$/, '')}/messages`;
  const res = await postWithRetry(
    url,
    {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    { model, max_tokens: 2000, system, messages },
  );
  const text = (res.data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
  return { reply: text || '未能生成回复', usage: res.data.usage, model };
}

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
    console.error('[MedWear AI]', err.code || err.message);
    return {
      reply: null,
      error: mapLlmError(err, provider.label),
      model: config.model,
      provider: provider.id,
      isRealAi: false,
    };
  }
}

async function testAiConnection({ providerId, apiKey, model }) {
  const provider = getProvider(providerId);
  const m = model || provider.defaultModel;
  const key = String(apiKey || '').trim();
  if (!key) return { ok: false, error: 'API Key 为空' };

  try {
    if (provider.format === 'anthropic') {
      await chatAnthropic({
        apiKey: key,
        baseUrl: provider.baseUrl,
        model: m,
        system: 'Reply with exactly: OK',
        messages: [{ role: 'user', content: 'ping' }],
      });
    } else {
      await chatOpenAI({
        apiKey: key,
        baseUrl: provider.baseUrl,
        model: m,
        messages: [
          { role: 'system', content: 'Reply with exactly: OK' },
          { role: 'user', content: 'ping' },
        ],
      });
    }
    return { ok: true, provider: providerId, model: m };
  } catch (err) {
    const msg = mapLlmError(err, provider.label);
    if (/余额不足/.test(msg)) return { ok: true, warning: msg };
    return { ok: false, error: msg };
  }
}

module.exports = {
  chatWithLLM, buildHealthContext, SYSTEM_PROMPT, DOCTOR_SYSTEM_PROMPT, testAiConnection, mapLlmError,
};
