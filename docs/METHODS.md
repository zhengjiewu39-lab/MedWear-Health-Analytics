# MedWear Analytics — Methods

This document describes the **transparent, reproducible** analytics pipeline used in real mode and benchmark evaluation. No black-box deep learning is used for core alerts/anomalies.

## Health Score

Daily composite score (0–100):

| Component | Weight | Rule |
|-----------|--------|------|
| Steps | 30% | `min(steps/10000, 1)` |
| Sleep | 25% | `min(totalSleepHours/8, 1)` |
| Resting HR | 20% | 50–75 bpm → 1.0; <50 → 0.7; else 0.5 |
| SpO2 | 15% | ≥95% → 1.0; ≥90 → 0.6; else 0.3 |
| HRV | 10% | `min(hrv/60, 1)` |

Implementation: `server/services/analyticsCore.js` → `computeDayScore()`

## Alerts {#alerts}

Threshold-based rules on the **target day**:

- **心率偏高**: mean HR > `heartRateMax` (default 100 bpm)
- **心率偏低**: mean HR < `heartRateMin` (default 50 bpm)
- **血氧偏低**: mean SpO2 < `spo2Min` (default 93%)
- **活动量不足**: steps > 0 and steps < 3000

## Anomalies {#anomalies}

14-day sliding window:

1. **HR spike**: ≥3 readings above personal mean + 2σ
2. **SpO2 event**: ≥2 readings below 93%

## Risk Stratification

From health score:

| Tier | Score |
|------|-------|
| low | ≥ 80 |
| moderate | 60–79 |
| high | < 60 |

## Trend Predictions (Real Mode)

Heuristic rules in `server/health/analytics.js`:

- RHR rise >5 bpm over 7 vs prior 7 days → cardio trend
- HRV drop >15% → stress/fatigue
- ≥3 days steps <4000 → sedentary risk
- Step collapse >50% day-over-day → illness-like pattern
- Repeated low SpO2 → respiratory flag
- Sleep <6h over 3 days → sleep deficit

## Dual-Mode Architecture

| Mode | Data | AI |
|------|------|-----|
| Demo | Synthetic clinical mock | Rule engine |
| Real | Apple Health import | OpenAI (optional) + analytics core |

## Limitations

- Not validated on clinical cohorts
- Apple Health export lacks continuous clinical-grade waveforms
- Screening categories are **wellness-oriented**, not diagnostic

See [EVALUATION.md](./EVALUATION.md) for benchmark protocol.
