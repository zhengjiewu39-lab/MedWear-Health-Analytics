/**
 * MedWear Desktop — Electron 主进程：启动内嵌 API + 应用窗口
 */
const {
  app, BrowserWindow, shell, dialog, Menu,
} = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

const DESKTOP_PORT = Number(process.env.MEDWEAR_DESKTOP_PORT || 38472);
const APP_URL = `http://127.0.0.1:${DESKTOP_PORT}`;

const isPackaged = app.isPackaged;

function getDevRoot() {
  return path.join(__dirname, '..');
}

/** app.asar 是文件，不能作为 spawn 的 cwd；使用 Resources 真实目录 */
function getSpawnCwd() {
  if (!isPackaged) return getDevRoot();
  return process.resourcesPath;
}

function getServerScript() {
  if (!isPackaged) return path.join(getDevRoot(), 'server.js');
  return path.join(app.getAppPath(), 'server.js');
}

let mainWindow = null;
let serverProcess = null;

function userDataRoot() {
  return app.getPath('userData');
}

function waitForHealth(maxMs = 45000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(`${APP_URL}/api/health`, (res) => {
        if (res.statusCode === 200) return resolve();
        retry();
      });
      req.on('error', retry);
      function retry() {
        if (Date.now() - start > maxMs) return reject(new Error('MedWear 服务启动超时'));
        setTimeout(tick, 500);
      }
    };
    tick();
  });
}

function startBackend() {
  const serverScript = getServerScript();
  const spawnCwd = getSpawnCwd();

  if (!isPackaged && !fs.existsSync(serverScript)) {
    throw new Error(`找不到 server.js: ${serverScript}`);
  }

  const env = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(DESKTOP_PORT),
    ALLOW_DEMO_AUTH: 'true',
    MEDWEAR_USER_DATA: userDataRoot(),
    MEDWEAR_JWT_SECRET: process.env.MEDWEAR_JWT_SECRET || 'medwear-local-jwt-v1',
    ELECTRON_RUN_AS_NODE: '1',
  };

  serverProcess = spawn(process.execPath, [serverScript], {
    cwd: spawnCwd,
    env,
    stdio: isPackaged ? 'pipe' : 'inherit',
  });

  if (serverProcess.stdout) {
    serverProcess.stdout.on('data', (d) => process.stdout.write(d));
  }
  if (serverProcess.stderr) {
    serverProcess.stderr.on('data', (d) => process.stderr.write(d));
  }

  serverProcess.on('error', (err) => {
    dialog.showErrorBox('MedWear 启动失败', `${err.message}\n\ncwd: ${spawnCwd}`);
  });
}

function stopBackend() {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    title: 'MedWear Health Analytics',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(APP_URL);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function buildMenu() {
  const template = [
    {
      label: 'MedWear',
      submenu: [
        { role: 'reload', label: '刷新页面' },
        { type: 'separator' },
        { role: 'quit', label: '退出 MedWear' },
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于',
          click: () => {
            dialog.showMessageBox({
              type: 'info',
              title: 'MedWear Health Analytics',
              message: '面向慢病与肿瘤早筛的人机协同 AI 框架',
              detail: '演示/研究用途，非医疗器械。\n默认账号: admin / admin123',
            });
          },
        },
        {
          label: '打开用户数据目录',
          click: () => shell.openPath(userDataRoot()),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    try {
      const buildIndex = isPackaged
        ? path.join(app.getAppPath(), 'build', 'index.html')
        : path.join(getDevRoot(), 'build', 'index.html');
      if (!isPackaged && !fs.existsSync(buildIndex)) {
        dialog.showErrorBox(
          '需要构建前端',
          '请先在本项目目录运行:\n\n  npm install\n  npm run build\n  npm run desktop:dev',
        );
        app.quit();
        return;
      }
      startBackend();
      await waitForHealth();
      buildMenu();
      createWindow();
    } catch (err) {
      dialog.showErrorBox('MedWear 无法启动', err.message);
      app.quit();
    }
  });

  app.on('window-all-closed', () => {
    stopBackend();
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  app.on('before-quit', () => stopBackend());
}
