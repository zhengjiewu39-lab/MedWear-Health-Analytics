# MedWear 单机软件 / 下载分发指南

MedWear 是 **Web 全栈应用**（React + Express），可打包为 **双击即用的桌面安装包**（`.dmg` / `.exe`），也支持浏览器一键启动。

---

## 方式一：桌面安装包（推荐 · 无需 Node.js）

**适合：** 论文答辩、导师演示、发给他人直接使用

### 在 Mac 上打包

```bash
cd ~/Desktop/医用可穿戴设备数据分析平台   # 或你的克隆目录
npm install
npm run desktop:mac
```

完成后在 **`release/`** 目录得到：

| 文件 | 说明 |
|------|------|
| `MedWear-0.1.0-mac.dmg` | 双击安装到「应用程序」 |
| `MedWear-0.1.0-mac.zip` | 便携版，解压后双击 `.app` |

### 在 Windows 上打包

```bash
npm install
npm run desktop:win
```

生成 `release/MedWear-0.1.0-Setup.exe`，按向导安装即可。

### 使用桌面版

1. 打开 **`release/MedWear-0.1.0-mac.dmg`**
2. 将 **MedWear Health Analytics** 拖入「应用程序」
3. **不要直接双击图标** — 若提示「文件已损坏」，见下方 **macOS 安全提示**
4. 登录：`admin` / `admin123` 或 `demo` / `demo123`

### macOS 提示「文件已损坏」？（不是真损坏）

这是 **未购买 Apple 开发者签名** 时 Gatekeeper 的常见误报。任选一种方式：

**方式 A（推荐）：双击 `release/安装 MedWear.command`**

会自动清除隔离标记并启动应用。

**方式 B：终端一行命令**

```bash
xattr -cr "/Applications/MedWear Health Analytics.app" && open "/Applications/MedWear Health Analytics.app"
```

**方式 C：右键打开**

在「应用程序」中 **右键** MedWear → **打开** → 点 **打开**（仅首次需要）。

若仍被拦截：**系统设置 → 隐私与安全性 → 仍要打开**。

**数据存储位置（桌面版）：**

- macOS: `~/Library/Application Support/MedWear Health Analytics/medwear-data/`
- Windows: `%APPDATA%/MedWear Health Analytics/medwear-data/`

---

## 方式二：一键本地应用（需 Node.js）

**前提：** 已安装 [Node.js 18+](https://nodejs.org/)

```bash
git clone https://github.com/zhengjiewu39-lab/MedWear-Health-Analytics.git
cd MedWear-Health-Analytics
npm install
npm run app
```

- 自动构建前端、启动服务、打开浏览器
- 访问：**http://localhost:3001**
- macOS 也可双击项目根目录的 **`启动 MedWear.command`**

---

## 方式三：Docker 容器

```bash
docker compose up --build
```

打开 **http://localhost:3001**。数据持久化在 `./data`。

---

## 方式四：zip 便携包（免 Git）

```bash
npm install
npm run build
npm run pack:zip    # → dist/MedWear-Health-Analytics.zip
```

对方解压后执行 `npm install --omit=dev && npm run app`。

---

## 开发 vs 发布模式

| 模式 | 命令 | 端口 | 用途 |
|------|------|------|------|
| 开发 | `npm run dev` | 3000 + 3001 | 改代码、热更新 |
| 浏览器单机 | `npm run app` | 3001 | 本地演示 |
| 桌面开发调试 | `npm run build && npm run desktop:dev` | 38472 | 调试 Electron |
| 桌面安装包 | `npm run desktop:mac` / `desktop:win` | — | 可分发软件 |
| Docker | `docker compose up` | 3001 | 服务器部署 |

---

## 常见问题

**Q: `npm run app` 报错 `ENOENT /package.json`？**  
A: 未进入项目目录。先 `cd` 到含 `package.json` 的 MedWear 文件夹。

**Q: `idealTree already exists`？**  
A: 先单独执行 `npm install`，再 `npm run app`；不要在根目录 `/` 运行。

**Q: 提示 `spawn ENOTDIR` 无法启动？**  
A: 旧版 DMG 的已知问题，已修复。请删除旧应用后，用最新 `release/MedWear-0.1.0-mac.dmg` 重装；或终端执行 `npm run app`。

**Q: 提示「文件已损坏」？**  
A: 执行 `xattr -cr "/Applications/MedWear Health Analytics.app"`，或双击 `release/安装 MedWear.command`。

**Q: 能否完全离线？**  
A: 可以。演示模式本地运行；仅医院地图与外部 AI 需联网。

**Q: 能上架 App Store 吗？**  
A: 需额外合规审查；当前为 **研究演示**，见 [docs/ETHICS.md](ETHICS.md)。

---

## 生产环境变量（可选）

| 变量 | 说明 |
|------|------|
| `PORT` / `MEDWEAR_DESKTOP_PORT` | 服务端口（桌面默认 38472） |
| `MEDWEAR_USER_DATA` | 用户数据根目录（Electron 自动设置） |
| `MEDWEAR_JWT_SECRET` | 生产 JWT 密钥 |
| `ALLOW_DEMO_AUTH` | 是否允许 demo 账号 |
| `OPENAI_API_KEY` | 真实模式 AI（可选） |
