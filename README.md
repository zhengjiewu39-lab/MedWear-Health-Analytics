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

```bash
npm install
npm run dev          # API :3001 + frontend :3000
```

| Service | URL |
|---------|-----|
| Web app | http://localhost:3000 |
| API | http://localhost:3001 |
| Analytics Lab | http://localhost:3000/research |

**Accounts:** `demo/demo123` · `admin/admin123`

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
| `/ai/*` | Anomaly, prediction, sleep, digital twin |
| `/ecg` | ECG visualization demo (synthetic) |
| `/platform` | Integration API demo |

---

## Disclaimer

For demonstration, education, and research prototyping — **not a medical device**. Screening and AI outputs require professional clinical review.

---

## License

MIT
