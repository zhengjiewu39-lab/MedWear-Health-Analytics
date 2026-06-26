# Project Overview

MedWear is an end-to-end wearable health analytics platform demonstrating how consumer device data can be transformed into explainable insights within a privacy-preserving, locally-hosted architecture.

## System Architecture

```
Apple Health Export (XML/ZIP)
        ↓
  SAX Stream Parser
        ↓
  data/health-store.json (local)
        ↓
  Analytics Core (scores, alerts, anomalies)
        ↓
  UI Modules (dashboard, screening, reports)
```

## Dual-Mode Design

| Mode | Data | AI |
|------|------|-----|
| Demo | Synthetic clinical mock | Rule-based engine |
| Real | User-imported Apple Health | Optional OpenAI LLM |

Modes are isolated via `X-MedWear-Mode` header — real mode never falls back to mock data.

## Core Analytics

Documented in [METHODS.md](./METHODS.md):

- Composite health score (steps, sleep, RHR, SpO2, HRV)
- Threshold alerts
- Personal-baseline 2σ anomaly detection
- 3-tier risk stratification

## Clinical Workflow

1. Continuous monitoring & alerts
2. Multi-category disease screening with literature citations
3. Exam appointment booking
4. Structured doctor report generation

## Engineering

- 40+ REST API endpoints
- 20 routed UI pages
- Benchmark dataset + evaluation CLI
- GitHub Actions CI + Docker

## Known Demo Surfaces

These are explicitly labeled in the UI:

- ECG waveform page (procedural, not Apple Health ECG)
- Platform integration API (FHIR-style mock)

## Limitations

- Not clinically validated
- Single-user local storage model
- Apple ecosystem export path only (no direct Watch API)
