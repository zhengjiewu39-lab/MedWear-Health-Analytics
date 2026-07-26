#!/usr/bin/env node
/**
 * 诊断 DeepSeek / AI 连接 — 在项目目录运行: npm run test:ai
 */
require('dotenv').config();
process.env.ALLOW_DEMO_AUTH = process.env.ALLOW_DEMO_AUTH || 'true';

const dns = require('dns');
const https = require('https');
const { loadConfig, getApiKey, isAiConfigured, CONFIG_FILE } = require('../server/ai/config');
const { testAiConnection } = require('../server/ai/llm');
const { doctorChat } = require('../server/ai/chatService');
const { getProvider } = require('../server/data/provider');

async function pingHost(host) {
  return new Promise((resolve) => {
    dns.lookup(host, { family: 4 }, (err, address) => {
      if (err) return resolve({ ok: false, error: err.message });
      const req = https.request(
        { host, port: 443, path: '/', method: 'HEAD', family: 4, timeout: 8000 },
        (res) => resolve({ ok: true, address, status: res.statusCode }),
      );
      req.on('error', (e) => resolve({ ok: false, address, error: e.message }));
      req.on('timeout', () => { req.destroy(); resolve({ ok: false, address, error: 'timeout' }); });
      req.end();
    });
  });
}

async function main() {
  console.log('\n=== MedWear AI 连接诊断 ===\n');
  console.log('配置文件:', CONFIG_FILE);
  console.log('已配置:', isAiConfigured());
  const cfg = loadConfig();
  console.log('提供商:', cfg.provider, '/', cfg.model);
  console.log('Key 长度:', getApiKey().length, '(不显示明文)\n');

  const ping = await pingHost('api.deepseek.com');
  console.log('DNS/HTTPS api.deepseek.com:', ping.ok ? `✓ ${ping.address} (${ping.status})` : `✗ ${ping.error}`);

  if (!isAiConfigured()) {
    console.log('\n请先在系统设置配置 DeepSeek Key，或在 .env 设置 DEEPSEEK_API_KEY\n');
    process.exit(1);
  }

  console.log('\n测试 API Key...');
  const test = await testAiConnection({
    providerId: cfg.provider,
    apiKey: getApiKey(),
    model: cfg.model,
  });
  console.log(test.ok ? '✓ Key 有效' : `✗ ${test.error}`);
  if (test.warning) console.log('⚠', test.warning);

  console.log('\n测试临床助手对话...');
  const chat = await doctorChat(
    { message: '请只回复 OK', history: [] },
    getProvider('demo'),
    'demo',
  );
  if (chat.success) {
    console.log('✓ 对话成功:', chat.reply?.slice(0, 80));
    console.log('\n若浏览器仍失败：请用 http://localhost:3001 打开，Cmd+Shift+R 强制刷新，重新登录。\n');
    process.exit(0);
  }
  console.log('✗ 对话失败:', chat.message || chat.error);
  console.log('\n建议: 检查校园网/VPN，或在 .env 中设置 DEEPSEEK_API_KEY 后 npm run app:fresh\n');
  process.exit(1);
}

main().catch((err) => {
  console.error('诊断异常:', err.message);
  process.exit(1);
});
