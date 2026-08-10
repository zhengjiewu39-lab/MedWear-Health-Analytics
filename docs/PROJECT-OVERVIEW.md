# Project Overview

MedWear is a **local-first wearable health analytics research prototype** — consumer device data transformed into explainable insights without cloud upload by default.

> **Methods:** [METHODS.md](./METHODS.md) (auto-synced via `npm run docs:sync`) · live disclosure: `GET /api/methodology/transparency`

## System Architecture

```
Apple Health Export (XML/ZIP)
        ↓
  SAX Stream Parser
        ↓
  data/health-store.json (local)
        ↓
  Analytics Core — BHI + MAD heuristic + rule-engine alerts
        ↓
  UI Modules (dashboard, screening, reports)
```

## Dual-Mode Design

| Mode | Data | Analytics | AI |
|------|------|-----------|-----|
| Demo | Synthetic clinical mock | BHI + robust MAD + rule engine | `MedWear-RuleEngine-v1` |
| Real | User-imported Apple Health | Same core pipeline | Optional LLM + same rule engine |

Modes are isolated via `X-MedWear-Mode` header — real mode never falls back to mock data.

## Core Analytics (heuristic — not clinically validated)

See [METHODS.md](./METHODS.md):

- **Behavioral Health Index (BHI)** — continuous sigmoid/Gaussian components (steps, sleep, RHR, SpO₂, HRV). API field `healthScore` = BHI (backward-compatible name).
- **Threshold alerts** — peak/single-reading wearable-style sensitivity
- **Robust MAD anomaly heuristic** — personal baseline with activity context filter (not mean + 2σ)
- **3-tier risk stratification** from BHI (≥80 / 60–79 / <60)
- **Rule engine screening** — evidence-weighted placeholders, not a trained ML ensemble

## Optional ONNX Inference Backend

The **rule engine is the default core** for alerts, BHI, MAD anomalies, and benchmark evaluation (`npm run evaluate` never loads ONNX).

| Item | Detail |
|------|--------|
| Artifact | `server/ai/models/medwear_rf.onnx` (sklearn RF exported via `experiments/medwear/train.py`) |
| Training data | Synthetic export `features_v1.csv` from `benchmarks/wearable-analytics-dataset.json` (n=5000, seed=42) |
| Used in | `runFullAnalysis()` screening path only |
| Fallback | Silent `feature-heuristic-fallback` when ONNX load/inference fails |

See [METHODS.md](./METHODS.md) § Optional ONNX inference backend.

**Limitations:** MAD k-values, activity thresholds, and BHI weights are empirical; no external outcome calibration; no multiple-testing correction; incomplete artifact modeling.

## Exploratory Cohort Scenario Simulation

Synthetic screened-vs-unscreened cohort (`outcomeModel.js`) — outcomes are **highly parameter-driven** (stage distribution, treatment rates, survival tables). For methodology demonstration and sensitivity analysis only (no p-values). See `GET /api/outcomes/scenarios`.

## Clinical Workflow (decision-support prototype)

1. Continuous monitoring & heuristic alerts
2. Multi-category screening with literature citations (not diagnosis)
3. Exam appointment booking
4. Structured doctor report generation

## Engineering

- 40+ REST API endpoints
- 20 routed UI pages
- Benchmark dataset + evaluation CLI (`npm run evaluate`)
- GitHub Actions CI (`npm run docs:verify`) + Docker

## Known Demo Surfaces

Explicitly labeled in the UI:

- ECG waveform page (procedural, not Apple Health ECG)
- Platform integration API (FHIR-style mock)
- Default login credentials — **local demo only** (see README / ETHICS)

## Security (local research prototype)

Default accounts (`admin/admin123`, `demo/demo123`) and demo JWT secrets are for **local development only**. Production deployments must rotate `MEDWEAR_JWT_SECRET`, `MEDWEAR_ENCRYPTION_KEY`, passwords, and disable demo auth.

## Limitations

- Not clinically validated · not a medical device (SaMD)
- Single-user local storage model
- Apple ecosystem export path only (no direct Watch API)
