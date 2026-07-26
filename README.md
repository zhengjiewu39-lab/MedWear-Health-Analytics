# MedWear · Medical Wearable Health Analytics Platform

A full-stack **digital health analytics platform** — Apple Health import, transparent statistical analysis, clinical screening workflow, and reproducible benchmarks.

Connects consumer wearables to actionable health insights with **local-first privacy** and **explainable methods**.

---

## Highlights

| Capability | Description |
|------------|-------------|
| **Dual-mode architecture** | Demo (synthetic) vs Real (Apple Health) — fully isolated |
| **Apple Health pipeline** | SAX streaming parser → local JSON store → analytics |
| **Transparent analytics** | Health score, threshold alerts, personal-baseline 2σ anomalies |
| **Clinical workflow** | Screening → exam booking → structured doctor report |
| **Analytics Lab** | In-app benchmark charts, methods transparency, evaluation metrics |
| **Engineering quality** | Unit tests, CI, Docker, audit log, encrypted vault |

---

## Tech Stack

- **Frontend:** React 18, MUI 5, Recharts, React Router 6
- **Backend:** Express 5, SAX XML parser, local JSON persistence
- **AI:** Rule engine (demo) + optional OpenAI (real mode)
- **Security:** JWT auth, audit log, AES-256-GCM health vault

---

## Quick Start

### 开发（改代码）

```bash
npm install
npm run dev          # API :3001 + 前端 :3000
```

### 桌面安装包（无需 Node.js，双击即用）

在项目目录打包（仅需一次）：

```bash
npm install
npm run desktop:mac    # 生成 release/MedWear-0.1.0-mac.dmg
```

将 **`release/MedWear-0.1.0-mac.dmg`** 发给他人：双击安装 → 从「应用程序」打开 **MedWear Health Analytics**。  
Windows 打包：`npm run desktop:win` → `release/MedWear-0.1.0-Setup.exe`。

### 单机软件（需 Node.js，浏览器打开）

**必须先进入项目文件夹**（不能在系统根目录 `/` 运行）：

```bash
cd ~/Desktop/医用可穿戴设备数据分析平台
npm install          # 只需第一次
npm run app          # 自动打开 http://localhost:3001
```

macOS 也可 **双击** 项目根目录下的 `启动 MedWear.command`。

账号：`admin` / `admin123` · `demo` / `demo123`

**常见错误：**

| 报错 | 原因 | 解决 |
|------|------|------|
| `ENOENT ... /package.json` | 在错误目录（如 `/`）运行 | 先 `cd` 到项目文件夹 |
| `Tracker "idealTree" already exists` | 在 `npm run app` 里嵌套运行了 npm | 先单独执行 `npm install`，再 `npm run app`；或 `npm cache clean --force` |

详细打包与 Docker 分发见 **[docs/DESKTOP.md](docs/DESKTOP.md)**。

| 模式 | 命令 | 访问地址 |
|------|------|----------|
| 开发 | `npm run dev` | http://localhost:3000 |
| **桌面安装包** | **`npm run desktop:mac`** | 双击 `.app` / `.dmg` |
| **单机应用** | **`npm run app`** | **http://localhost:3001** |
| Docker | `docker compose up --build` | http://localhost:3001 |

**Accounts:** `demo/demo123` · `admin/admin123`

> **Demo vs production:** Demo accounts work when `NODE_ENV !== 'production'` or `ALLOW_DEMO_AUTH=true`. In production, set `MEDWEAR_JWT_SECRET`, `MEDWEAR_ENCRYPTION_KEY`, and `CORS_ORIGIN`. See `.env.example`.

---

## Apple Health Import (Real Mode)

1. iPhone **Health** App → Export All Health Data → `apple_health_export.zip`
2. Switch to **真实模式** → **数据导入**
3. Upload zip or drop into `health-import/` and scan

Supported: HeartRate, OxygenSaturation, StepCount, SleepAnalysis, HRV, ActiveEnergyBurned, RespiratoryRate.

> Data stays local in `data/health-store.json`.

---

## Evaluation & Reproducibility

```bash
npm run test:server    # unit tests
npm run evaluate       # → benchmarks/results/latest.json
```

| Metric (n=8) | Value |
|--------------|-------|
| Alert F1 | 0.94 |
| Anomaly Accuracy | 0.75 |
| Risk Accuracy | 0.63 |

### Documentation

| Doc | Topic |
|-----|-------|
| [docs/METHODS.md](docs/METHODS.md) | Algorithm formulas |
| [docs/EVALUATION.md](docs/EVALUATION.md) | Benchmark protocol |
| [docs/ETHICS.md](docs/ETHICS.md) | Privacy & limitations |
| [docs/REPRODUCIBILITY.md](docs/REPRODUCIBILITY.md) | Docker, CI |
| [docs/LITERATURE.md](docs/LITERATURE.md) | References |

---

## Main Modules

| Route | Module |
|-------|--------|
| `/dashboard` | Health overview |
| `/import` | Apple Health import |
| `/research` | Analytics evaluation center |
| `/screening` | Clinical screening with citations |
| `/doctor-report` | Clinician report |
| `/monitoring` | Real-time vitals |
| `/ai/anomaly` | Anomaly detection |
| `/ai/predictive` | Predictive analytics |
| `/methodology` | Methods documentation |

---

## Disclaimer

For demonstration, education, and research prototyping — **not a medical device**. Screening and AI outputs require professional clinical review.

---

## License

MIT — see [LICENSE](LICENSE).

## Security & contributing

- [SECURITY.md](SECURITY.md) — vulnerability reporting
- [CONTRIBUTING.md](CONTRIBUTING.md) — development workflow
