# MedWear Analytics — Methods

> **Auto-synced (EN/ZH parity)** from `server/config/methodologyTransparency.js`. Regenerate: `npm run docs:sync` · Verify: `npm run docs:verify`.  
> Live API: `GET /api/methodology/transparency` · **Engine:** BHI + robust MAD heuristic + `MedWear-RuleEngine-v1`

Transparent, reproducible pipeline for real mode and benchmark evaluation. **No black-box DL** for core alerts/anomalies.  
**Not the legacy pipeline:** no discrete 3-tier composite health score; no personal-baseline mean + 2σ anomaly rule.

## Behavioral Health Index (BHI)

**BHI is a behavioral wellness index — NOT a calibrated disease-risk score.**

| Component | Weight | Function |
|-----------|--------|----------|
| steps | 28% | see formulas below |
| sleep | 24% | see formulas below |
| rhr | 20% | see formulas below |
| spo2 | 16% | see formulas below |
| hrv | 12% | see formulas below |

**Formulas:**

- Steps (28%): sigmoid — `1 / (1 + exp(-(steps - 5500) / 1800))`
- Sleep (24%): Gaussian peak ~7.25 h — `(deep + rem + light + awake) / 60`
- RHR (20%): age/sex-adjusted Gaussian — ref ≈ 65 (F) / 62 (M) + 0.15×max(0, age−40)
- SpO₂ (16%): logistic — `1 / (1 + exp(-(spo2 - 94) / 0.75))`
- HRV (12%): age-adjusted cap — `min(1, hrv / ref)` where ref declines with age
- Trend (optional): ±3 pts max vs prior 7-day BHI mean
- Missing data: re-normalize over available components; median-imputation sensitivity via `missingDataSensitivity()`

**API field:** `healthScore` = Behavioral Health Index (BHI). Field name healthScore is kept for backward compatibility; values are BHI (behavioral wellness index), not a calibrated disease-risk score.

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

## BHI Watch Tiers (not disease risk)

**Tier labels (Stable / Observe / Watch closely) are heuristic BHI bands — not validated against clinical outcomes.**

| Internal key | UI label (EN) | BHI range |
|--------------|---------------|-----------|
| low | Stable (BHI≥80) | ≥ 80 |
| moderate | Observe (BHI 60–79) | 60–79 |
| high | Watch closely (BHI<60) | < 60 |

Implementation: `server/config/bhiWatchTier.js → classifyBHIWatchTier()`

## Evidence Levels (A/B/C)

**A/B/C levels reflect author annotation from public literature — NOT independent third-party ratings.**

| Level | Criteria |
|-------|----------|
| A | International authoritative guidelines and/or high-quality RCTs (including major screening RCTs) |
| B | Prospective cohorts, validation studies, or national guidelines without direct top-tier RCT |
| C | Expert consensus, indirect links in reviews, or weak wearable-proxy literature |

Implementation: `server/data/researchReferences.js → EVIDENCE_LEVEL_RULES + EVIDENCE_RATIONALE`

## Rule Engine (Screening)

**Domain weights are configurable placeholders — not trained model votes.** `engineType: evidence-weighted-rule-engine` · Version: `MedWear-RuleEngine-v1`. Confidence capped at 0.85.

| Domain | Weight |
|--------|--------|
| cardiovascular | 28% |
| vitals | 22% |
| oncology screening | 18% |
| metabolic | 16% |
| sleep | 16% |

Honest API fields: `referenceDomainLabel`, `domainWeightedSummaries`, `heuristicConfidence`. Deprecated aliases (not shown in UI): aiModel, models, modelVotes, ensembleConfidence.

Removed claims: CardioNet-style declared accuracy; ensemble confidence clamped to 0.98; fake model validation AUC.

## Robustness Testing

**BHI and anomaly pipelines return finite scores/tiers without throwing; outputs may degrade gracefully.**

- Missing day data / empty sensor arrays
- Missing sensor dimensions (no HRV, no SpO₂)
- Single-point HR/SpO₂ outliers (artifact cleaning)
- Sensor drift (gradual HR elevation over window)
- Motion artifact (high-activity days excluded from MAD baseline)
- Recovery/rest day (low steps, suppressed activity alerts context)

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
