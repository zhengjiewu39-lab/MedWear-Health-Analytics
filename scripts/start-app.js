#!/usr/bin/env node
/**
 * MedWear 单机应用启动器：构建前端 → 清理端口 → 启动一体服务 → 自动打开浏览器
 * 用法: npm run app
 */
const { spawn, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

const root = path.join(__dirname, '..');
const pkgPath = path.join(root, 'package.json');
const buildIndex = path.join(root, 'build', 'index.html');
const freePortsScript = path.join(__dirname, 'free-ports.js');
const port = Number(process.env.PORT || 3001);
const url = `http://localhost:${port}`;

function ensureProjectRoot() {
  if (!fs.existsSync(pkgPath)) {
    console.error('\n[MedWear] 错误：未在项目目录中运行。\n');
    console.error('请先在终端执行（复制整段）：');
    console.error(`  cd "${root}"`);
    console.error('  npm install');
    console.error('  npm run app\n');
    process.exit(1);
  }
}

function needsRebuild() {
  if (!fs.existsSync(buildIndex)) return true;
  const buildTime = fs.statSync(buildIndex).mtimeMs;
  const watchFiles = [
    'src/pages/Settings.js',
    'src/pages/DoctorAiChat.js',
    'src/services/api.js',
    'server.js',
    'server/ai/config.js',
    'server/ai/llm.js',
    'server/security/crypto.js',
  ];
  return watchFiles.some((f) => {
    const fp = path.join(root, f);
    return fs.existsSync(fp) && fs.statSync(fp).mtimeMs > buildTime;
  });
}

function runFreePorts() {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [freePortsScript, '--port', String(port)], {
      cwd: root,
      stdio: 'inherit',
    });
    p.on('exit', () => resolve());
  });
}

/** 直接调用 react-scripts，避免在 npm run app 内再嵌套 npm（会触发 idealTree 冲突） */
function runBuild() {
  const rs = path.join(root, 'node_modules', 'react-scripts', 'scripts', 'build.js');
  if (!fs.existsSync(rs)) {
    console.error('\n[MedWear] 缺少依赖，请先在项目目录执行：');
    console.error(`  cd "${root}"`);
    console.error('  npm install\n');
    process.exit(1);
  }
  console.log('[MedWear] 构建前端界面...');
  const r = spawnSync(process.execPath, [rs], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' },
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function waitForServer(expectedPid, maxMs = 45000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      http.get(`${url}/api/health`, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          if (res.statusCode !== 200) {
            return retry(new Error(`健康检查 HTTP ${res.statusCode}`));
          }
          try {
            const json = JSON.parse(body);
            if (json.pid && json.pid !== expectedPid) {
              return retry(new Error(
                `端口 ${port} 被其他 MedWear 进程占用 (PID ${json.pid}，期望 ${expectedPid})。请先运行: npm run stop`,
              ));
            }
          } catch {
            return retry(new Error('健康检查响应无效'));
          }
          resolve();
        });
      }).on('error', (err) => retry(err));
    };

    const retry = (err) => {
      if (Date.now() - start > maxMs) {
        return reject(err || new Error('服务启动超时'));
      }
      setTimeout(tick, 400);
    };

    tick();
  });
}

function openBrowser(target) {
  const platform = process.platform;
  if (platform === 'darwin') spawn('open', [target], { stdio: 'ignore', detached: true });
  else if (platform === 'win32') spawn('cmd', ['/c', 'start', '', target], { stdio: 'ignore', detached: true });
  else spawn('xdg-open', [target], { stdio: 'ignore', detached: true });
}

async function main() {
  ensureProjectRoot();
  console.log('\n[MedWear] 正在准备单机应用...\n');
  console.log(`[MedWear] 项目目录: ${root}\n`);

  if (!fs.existsSync(path.join(root, 'node_modules'))) {
    console.error('[MedWear] 未找到 node_modules，请先执行一次：');
    console.error(`  cd "${root}" && npm install\n`);
    process.exit(1);
  }

  if (needsRebuild()) {
    console.log('[MedWear] 检测到代码更新，正在重新构建前端...');
    runBuild();
  }

  console.log(`[MedWear] 清理端口 ${port}（避免旧进程导致 AI fetch failed）...`);
  await runFreePorts();

  const server = spawn(process.execPath, [path.join(root, 'server.js')], {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(port),
      ALLOW_DEMO_AUTH: process.env.ALLOW_DEMO_AUTH || 'true',
      MEDWEAR_JWT_SECRET: process.env.MEDWEAR_JWT_SECRET || 'medwear-local-jwt-v1',
    },
  });

  let shuttingDown = false;
  let serverExited = false;

  const shutdown = (reason) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n[MedWear] 正在停止（${reason}）...`);
    if (!server.killed) server.kill('SIGTERM');
    setTimeout(() => {
      if (!server.killed) server.kill('SIGKILL');
      process.exit(0);
    }, 800);
  };

  process.stdin.resume();
  process.on('SIGINT', () => shutdown('Ctrl+C'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  server.on('exit', (code, signal) => {
    serverExited = true;
    if (shuttingDown) return;
    console.error(`\n[MedWear] ⚠️ 服务异常退出 (code=${code ?? '?'}, signal=${signal || '—'})。`);
    console.error('[MedWear] 若 AI 显示 fetch failed，请先执行: npm run stop');
    console.error('[MedWear] 然后重新运行: npm run app:fresh\n');
    process.exit(code != null && code !== 0 ? code : 1);
  });

  try {
    await waitForServer(server.pid);
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║  MedWear 已启动 — 请保持本终端窗口打开（勿按 Ctrl+C）    ║');
    console.log(`║  浏览器访问: ${url.padEnd(43)}║`);
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log('║  ⚠ 默认账号 admin/admin123 仅用于本地演示               ║');
    console.log('║  生产环境必须更换 JWT 密钥、加密密钥与管理员密码         ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log(`[MedWear] 服务 PID: ${server.pid}`);
    console.log('[MedWear] 演示账号: admin / admin123 （勿用于生产）');
    console.log('[MedWear] 诊断 AI: npm run test:ai');
    console.log('[MedWear] 按 Ctrl+C 停止\n');
    openBrowser(url);
  } catch (e) {
    console.error('[MedWear]', e.message);
    if (!server.killed) server.kill('SIGTERM');
    process.exit(1);
  }

  await new Promise((resolve) => {
    if (serverExited) return resolve();
    server.on('exit', resolve);
  });
}

main().catch((err) => {
  console.error('[MedWear] 启动失败:', err);
  process.exit(1);
});
