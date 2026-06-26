#!/usr/bin/env node
/**
 * MedWear 开发启动器：启动前清理端口，退出时自动释放 3000 / 3001
 */
const { spawn } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const freePortsScript = path.join(__dirname, 'free-ports.js');

function runFreePorts() {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [freePortsScript], { stdio: 'inherit', cwd: root });
    p.on('exit', () => resolve());
  });
}

function spawnProc(command, args, extraEnv = {}) {
  return spawn(command, args, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, BROWSER: 'none', ...extraEnv },
  });
}

async function main() {
  console.log('[MedWear] 准备启动开发环境...\n');
  await runFreePorts();

  const children = [];
  const server = spawnProc(process.execPath, [path.join(root, 'server.js')]);
  const client = spawnProc(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'start']);
  children.push(server, client);

  let shuttingDown = false;

  const shutdown = async (reason) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n[MedWear] 正在停止（${reason}）并释放端口...`);

    for (const child of children) {
      if (child.exitCode === null && !child.killed) {
        child.kill('SIGTERM');
      }
    }

    await new Promise((r) => setTimeout(r, 600));

    for (const child of children) {
      if (child.exitCode === null && !child.killed) {
        child.kill('SIGKILL');
      }
    }

    await runFreePorts();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('Ctrl+C'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGHUP', () => shutdown('SIGHUP'));

  server.on('exit', (code) => {
    if (!shuttingDown) shutdown(`API 退出 code=${code ?? '?'}`);
  });
  client.on('exit', (code) => {
    if (!shuttingDown) shutdown(`前端退出 code=${code ?? '?'}`);
  });
}

main().catch((err) => {
  console.error('[MedWear] 启动失败:', err);
  process.exit(1);
});
