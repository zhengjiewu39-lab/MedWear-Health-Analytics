# MedWear Analytics — Methods

> **Auto-synced** from `server/config/methodologyTransparency.js`. Regenerate: `npm run docs:sync`.  
> Live API: `GET /api/methodology/transparency`

Transparent, reproducible pipeline for real mode and benchmark evaluation. **No black-box DL** for core alerts/anomalies.

## Behavioral Health Index (BHI)

**BHI is a behavioral wellness index — NOT a calibrated disease-risk score.**

| Component | Weight | Function |
|-----------|--------|----------|
| steps | 28% | see formulas below |
| sleep | 24% | see formulas below |
| rhr | 20% | see formulas below |
| spo2 | 16% | see formulas below |
| hrv | 12% | see formulas below |

Formulas:

- Steps (28%): sigmoid — `1 / (1 + exp(-(steps - 5500) / 1800))`
- Sleep (24%): Gaussian peak ~7.25 h — `(deep + rem + light + awake) / 60`
- RHR (20%): age/sex-adjusted Gaussian — ref ≈ 65 (F) / 62 (M) + 0.15×max(0, age−40)
- SpO₂ (16%): logistic — `1 / (1 + exp(-(spo2 - 94) / 0.75))`
- HRV (12%): age-adjusted cap — `min(1, hrv / ref)` where ref declines with age
- Trend (optional): ±3 pts max vs prior 7-day BHI mean
- Missing data: re-normalize over available components; median-imputation sensitivity via `missingDataSensitivity()`

Implementation: `server/services/behavioralHealthIndex.js → analyticsCore.computeDayScore()`

**Limitations:** Not calibrated against clinical outcomes; No comorbidity or medication adjustment; Wearable proxy signals only.

## Alerts {#alerts}

Threshold alerts (wearable-style sensitivity). Implementation: `server/services/analyticsCore.js → evaluateDayAlerts()`

- Elevated HR: daily mean OR any peak > heartRateMax (default 100 bpm)
- Low HR: daily mean OR any nadir < heartRateMin (default 50 bpm)
- Low SpO₂: any reading < spo2Min (default 93%)
- Low activity: steps > 0 and steps < 3000

## Anomaly Detection {#anomalies}

**Heuristic rule engine — not a validated clinical anomaly detector. No multiple-testing correction.**

- Window: 14 days
- Baseline HR = median of readings on days with steps < activity threshold; flag when ≥3 readings > median + k·MAD×1.4826
- Individual SpO₂ baseline median − k·MAD (NOT fixed 93%)
- Defaults: hrMadK=2.5, spo2MadK=2, activity filter ≥6500 steps

### Sensitivity presets

| Preset | windowDays | hrMadK | spo2MadK | activityStepsThreshold |
|--------|------------|--------|----------|------------------------|
| strict | 14 | 3 | 2.5 | 7000 |
| default | 14 | 2.5 | 2 | 6500 |
| sensitive | 7 | 2 | 1.5 | 5500 |

Implementation: `server/services/robustAnomaly.js → analyticsCore.detectAnomaliesFromStore()`

## Risk Stratification (from BHI)

| Tier | BHI score |
|------|-----------|
| low | ≥ 80 |
| moderate | 60–79 |
| high | < 60 |

## Rule Engine (Screening)

**Domain weights are configurable placeholders — not trained model votes.** Version: `MedWear-RuleEngine-v1`. Confidence capped at 0.85.

| Domain | Weight |
|--------|--------|
| cardiovascular | 28% |
| vitals | 22% |
| oncology screening | 18% |
| metabolic | 16% |
| sleep | 16% |

Removed claims: CardioNet-style declared accuracy; ensemble confidence clamped to 0.98; fake model validation AUC.

## Exploratory Cohort Scenario Simulation

**Outcomes are highly parameter-driven. For methodology demonstration and sensitivity analysis only — do not report as inferential p-values or proven clinical benefit.**

Public parameters: STAGE_DISTRIBUTION, TREATMENT_INITIATION_RATE, CHRONIC_CONTROL_RATE, TIME_TO_TREATMENT, computeRiskScore coefficients.  
Scenarios: conservative, neutral, optimistic (via `GET /api/outcomes/scenarios`).

## Dual-Mode Architecture

| Mode | Data | Analytics | AI |
|------|------|-----------|-----|
| Demo | Synthetic mock | BHI + MAD + rule engine | Rule engine |
| Real | Apple Health import | BHI + MAD + rule engine | Optional LLM + same core |

See [EVALUATION.md](./EVALUATION.md) for benchmark protocol.
