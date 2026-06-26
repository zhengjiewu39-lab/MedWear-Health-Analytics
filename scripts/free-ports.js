#!/usr/bin/env node
/**
 * 释放 MedWear 开发占用的端口（默认 3000 前端 + 3001 API）
 * 用法: node scripts/free-ports.js [--port 3000] [--port 3001]
 */
const { execSync } = require('child_process');

const DEFAULT_PORTS = [3000, 3001];

function parsePorts() {
  const args = process.argv.slice(2);
  const ports = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' && args[i + 1]) {
      ports.push(Number(args[i + 1]));
      i++;
    }
  }
  return ports.length ? [...new Set(ports)] : DEFAULT_PORTS;
}

function killPid(pid, signal = 'SIGTERM') {
  try {
    process.kill(Number(pid), signal);
    return true;
  } catch {
    return false;
  }
}

function freePortUnix(port) {
  let freed = 0;
  try {
    const out = execSync(`lsof -ti tcp:${port}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    if (!out) return 0;
    out.split('\n').filter(Boolean).forEach((pid) => {
      if (killPid(pid, 'SIGTERM')) {
        console.log(`[MedWear] 已终止 PID ${pid}（端口 ${port}）`);
        freed++;
      }
    });
  } catch {
    /* 端口未被占用 */
  }
  return freed;
}

function freePortWin(port) {
  let freed = 0;
  try {
    const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8', shell: true });
    const pids = new Set();
    out.split('\n').forEach((line) => {
      const m = line.trim().match(/\s(\d+)\s*$/);
      if (m) pids.add(m[1]);
    });
    pids.forEach((pid) => {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore', shell: true });
        console.log(`[MedWear] 已终止 PID ${pid}（端口 ${port}）`);
        freed++;
      } catch { /* ignore */ }
    });
  } catch {
    /* 端口未被占用 */
  }
  return freed;
}

function freePort(port) {
  return process.platform === 'win32' ? freePortWin(port) : freePortUnix(port);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const ports = parsePorts();
  let total = 0;
  for (const port of ports) {
    total += freePort(port);
  }
  if (total > 0) {
    await sleep(400);
    for (const port of ports) {
      total += freePort(port);
    }
  }
  if (total === 0) {
    console.log(`[MedWear] 端口 ${ports.join(' / ')} 均未被占用`);
  } else {
    console.log(`[MedWear] 端口清理完成，可重新 npm run dev`);
  }
}

main();
