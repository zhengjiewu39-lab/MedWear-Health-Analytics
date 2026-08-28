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

- Steps (28%): sigmoid — `1 / (1 + exp(-(steps - 5500) / 1800))` (component used only when `steps > 0`; see step-zero limitation)
- Sleep (24%): Gaussian peak ~7.25 h — estimated sleep duration `(deep + rem + light) / 60` hours; **awake is excluded** from sleep duration
- Sleep score: `exp(-((hours - 7.25)^2) / (2 * 1.4^2))`
- RHR (20%): age/sex-adjusted Gaussian — ref = (male ? 62 : 65) + 0.15 × max(0, age−40); score `exp(-((rhr - ref)^2) / (2 * 12^2))`
- SpO₂ (16%): logistic — `1 / (1 + exp(-(spo2 - 94) / 0.75))`
- HRV-SDNN (12%): Apple Health `HeartRateVariabilitySDNN` (SDNN in ms, **not RMSSD**)
- SDNN reference: `ref_sdnn(age) = max(28, 50 - 0.45 * max(0, age - 30))`
- SDNN score: `min(1, sdnn / ref_sdnn(age))`
- Trend (primary day-scoring pathway): when prior data are available and at least three valid prior BHI scores exist, `computeDayScore()` applies the predefined trend adjustment relative to the prior seven-day mean (up to 7 prior days supplied by the caller), multiplier 0.12, adjustment capped ±3 points, final BHI [0,100]. The primary synthetic benchmark supplies prior-day data and therefore evaluates this conditional trend-adjusted BHI pathway.
- Missing data: re-normalize over available components; median-imputation sensitivity via `missingDataSensitivity()`

**API field:** `healthScore` = Behavioral Health Index (BHI). Field name healthScore is kept for backward compatibility; values are BHI (behavioral wellness index), not a calibrated disease-risk score.

Implementation: `server/services/behavioralHealthIndex.js → analyticsCore.computeDayScore()`

**Demographics fallback:** When age or biological-sex metadata are unavailable, the compatibility path uses age 45 and female as fallback values and marks the demographic configuration as inferred (`fallbackUsed: true`). These fallback values are software compatibility defaults and are not population reference standards.

**Step-zero limitation:** Zero step count is currently treated as unavailable for BHI component scoring (`steps > 0` required). The implementation cannot distinguish a true zero-step day from an absent daily step record in this path. The steps component is omitted and remaining BHI weights are renormalized.

**Limitations:** Not calibrated against clinical outcomes; No comorbidity or medication adjustment; Wearable proxy signals only.

## Primary benchmark scope (MedWear-Wearable-Analytics-Benchmark-v3)

Dataset: `MedWear-Wearable-Analytics-Benchmark-v3` · n=5000 · seed=42 · Product engine: `MedWear-AnalyticsCore-v1` · Reference: `independentSyntheticReference-v1` · Evaluation: engine-versus-reference-agreement.

**Evaluates:** Threshold signal outputs (fixed wearable-style alert rules); MAD robust anomaly outputs; BHI continuous score (trend-adjusted when prior days supplied); BHI watch tier.

**Does not evaluate:** Domain-weighted RuleEngine research-signal integration outputs; Exploratory cohort/scenario simulation modules; Optional ONNX experimental backend.

Independent synthetic reference labels are rule-generated synthetic reference labels and do not constitute clinical ground truth.

The ±8 BHI score-agreement criterion is a prespecified heuristic benchmark tolerance, not a clinically validated equivalence margin.

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

## Rule Engine (Research Signal Integration — exploratory)

**Exploratory — outside primary manuscript scope.** Not evaluated in MedWear-Wearable-Analytics-Benchmark-v3 primary benchmark Not part of the manuscript principal claims Not clinical validation or validated screening performance Not evidence of patient benefit

**Domain weights are configurable placeholders — not trained model votes.** `engineType: evidence-weighted-rule-engine` · Version: `MedWear-RuleEngine-v1`. Confidence capped at 0.85.

| Domain | Weight |
|--------|--------|
| cardiovascular | 28% |
| vitals | 22% |
| oncology-related reference domain | 18% |
| metabolic | 16% |
| sleep | 16% |

Honest API fields: `overallBhiTier`, `attentionScore`, `evidenceAdjustedAttentionScore`, `signalLevel`, `heuristicSupport`, `referenceDomainLabel`, `domainWeightedSummaries`. Deprecated aliases (not shown in UI): overallRisk, risk, rawRisk, calibratedRisk, level, heuristicConfidence, confidence, aiModel, models, modelVotes, ensembleConfidence.

Fusion presentation weights (wearable 0.55 / clinical 0.3 / behavioral 0.15): Configurable presentation weights selected for prototype demonstration — not learned coefficients and not externally validated.

Removed claims: CardioNet-style declared accuracy; ensemble confidence clamped to 0.98; fake model validation AUC.

## Optional ONNX inference backend

**The deterministic rule-based analytics (BHI + MAD + research signal rules) are the primary research pathway — ONNX is disabled by default unless explicitly enabled.**

| Item | Detail |
|------|--------|
| Enable flag | `MEDWEAR_ENABLE_ONNX=false (default — opt-in only)` |
| Artifact | `server/ai/models/medwear_rf.onnx + medwear_rf.meta.json` |
| Training | `experiments/medwear/train.py (sklearn RandomForest → skl2onnx export)` |
| Training data | MedWear-Wearable-Analytics-Benchmark-v3 synthetic export (n=5000, seed=42) → experiments/data/medwear/features_v1.csv via scripts/export_features.js |
| Label target | BHI watch tier (low/moderate/high) — experimental comparison display only when ONNX enabled; never feeds domain attention scores |
| Runtime | onnxruntime-node via server/ai/onnxInference.js |
| Used in | runFullAnalysis() when MEDWEAR_ENABLE_ONNX=true — experimentalBhiTierComparison field only |
| **Not used in** | deriveConditionRisk / domain attention scores / npm run evaluate / MedWear-AnalyticsCore-v1 primary benchmark |
| Fallback | `rule-engine-only (default) or feature-heuristic-fallback when enabled but load fails` — Default off. When enabled, ONNX failures silently skip to rule-engine BHI — no thrown errors. |

Implementation: `server/config/onnxConfig.js → server/ai/onnxInference.js → server/ai/engine.js`. Optional experimental backend — disabled by default; not part of MedWear-AnalyticsCore-v1 primary benchmark; BHI-tier comparison only when enabled; no disease-screening or clinical-performance claims; deterministic rule-based analytics remain the primary research pathway.

## Robustness Testing

**BHI and anomaly pipelines return finite scores/tiers without throwing; outputs may degrade gracefully.**

- Missing day data / empty sensor arrays
- Missing sensor dimensions (no HRV, no SpO₂)
- Single-point HR/SpO₂ outliers (artifact cleaning)
- Sensor drift (gradual HR elevation over window)
- Motion artifact (high-activity days excluded from MAD baseline)
- Recovery/rest day (low steps, suppressed activity alerts context)

## Exploratory cohort scenario simulation (outside primary manuscript scope)

**Outside the primary manuscript scope. Exploratory modules — synthetic, parameter-driven, not prospective validation, not used in primary benchmark, not evidence of clinical benefit.**

- Outside the primary manuscript scope
- Synthetic parameter-driven simulation — not prospective validation
- Not used in MedWear-Wearable-Analytics-Benchmark-v3 primary benchmark
- Not evidence of clinical benefit or validated screening performance

Public parameters: STAGE_DISTRIBUTION, TREATMENT_INITIATION_RATE, CHRONIC_CONTROL_RATE, TIME_TO_TREATMENT, computeRiskScore coefficients.  
Scenarios: conservative, neutral, optimistic (via `GET /api/outcomes/scenarios`).

## Dual-mode architecture

| Mode | Data | Analytics | AI |
|------|------|-----------|-----|
| Synthetic evaluation | Synthetic benchmark cohort (seed=42) | BHI + MAD + rule engine | Rule engine |
| Real-data (local-first) | Apple Health import | BHI + MAD + rule engine | Optional LLM + same core |

## One-click manuscript reproduction

**Primary path:** synthetic benchmark (seed=42) → BHI → fixed threshold signal flags → robust MAD anomaly → BHI watch tier → engine-versus-reference evaluation metrics

**Optional experimental appendix:** Optional appendix: ONNX BHI-tier comparison and transparent component charts (not primary benchmark endpoints).

Notebook: `notebooks/paper_reproduction.ipynb` · Bridge: `scripts/paper_reproduction_bridge.js`

See [EVALUATION.md](./EVALUATION.md) for benchmark protocol.
