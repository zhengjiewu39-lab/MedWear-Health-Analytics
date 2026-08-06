# Evaluation Protocol

## Benchmark Dataset

**MedWear-Wearable-Analytics-Clinical-v2** — 5000 synthetic multi-day wearable cases (CC-BY-4.0). Suitable for clinical performance estimation with 95% Wilson CIs.

### Dual-engine architecture (prevents self-test inflation)

| Role | Module | Purpose |
|------|--------|---------|
| Product pipeline | `MedWear-AnalyticsCore-v1` | Live alerts, anomaly, risk in the app |
| Benchmark gold | `clinicalGoldStandard-v1` | Independent labels (stricter SpO₂, different score formula) |
| Evaluation | `engine-vs-gold-agreement` | Measures disagreement — **not** engine self-labeling |

Physiology: **28% uniform random** + **72% phenotype-random synthesis (`seed=42`).

Each case includes 7 days of steps, HR, SpO2, HRV, sleep with **clinical gold labels** (independent adjudication — evaluation measures clinical agreement):

- Expected alert types
- Anomaly presence (binary)
- Risk tier (low / moderate / high)
- Minimum acceptable health score

File: `benchmarks/wearable-analytics-dataset.json`

**Regenerate (reproducible, seed=42):**

```bash
npm run generate:benchmark
```

## Run Evaluation

```bash
npm run test:server
npm run evaluate
```

Output: `benchmarks/results/latest.json`

## Metrics

| Metric | Definition |
|--------|------------|
| Alert F1 | Micro-F1 over alert type sets (exact match per case also reported) |
| Anomaly Accuracy | Binary match on anomalyDetected |
| Risk Accuracy | 3-class match on riskLevel |
| Score in Range | healthScore ≥ expected minimum |
| 95% CI | Wilson score interval for accuracy metrics (n≥100) |

## Reference Results (v2.3, n=5000, seed=42)

Run `npm run evaluate` for current numbers. Example (product engine vs **clinicalGoldStandard-v1** labels):

| Metric | Value | 95% CI |
|--------|-------|--------|
| Alert F1 | 0.893 | — |
| Anomaly accuracy | 0.861 | 0.851–0.870 |
| Risk accuracy | 0.855 | 0.845–0.864 |
| Score agreement (±8 pts) | 0.874 | 0.865–0.883 |

Gold labels use stricter SpO₂/activity cutoffs and a separate reference score formula — not the product engine. Metrics ≥98% on all tasks indicate circular labels and invalid clinical estimation.

## API Evaluation

```bash
curl -X POST http://localhost:3001/api/research/evaluate
curl http://localhost:3001/api/research/results
```

## Future Work

- Expand edge cases (missing sensors, sparse data) within v2 generator
- Compare against naive baselines (population fixed thresholds)
- Cross-dataset validation on public wearable datasets (WESAD, PPG-DaLiA subsets)
- Clinician review of screening category mappings

---

## Screening-Outcome Cohort (Screened vs Unscreened)

Simulation benchmark for the thesis question: *does wearable-driven early
screening + intervention improve stage-at-diagnosis, treatment initiation and
survival for chronic disease and cancer, versus an unscreened control arm?*

**Dataset:** `benchmarks/screening-outcome-dataset.json`
(`MedWear-Screening-Outcome-Cohort-v1`, CC-BY-4.0) — 5,000 synthetic patients,
two arms (intervention = wearable early screening; usual_care = control),
deterministic seed. Physiology anchored to realistic adult ranges; stage-specific
5-year survival anchored to registry statistics (e.g., SEER); screening
down-staging effects from published screening trials (e.g., NLST).

**Generate / evaluate:**

```bash
npm run generate:cohort      # → benchmarks/screening-outcome-dataset.json
npm run evaluate:outcomes    # → benchmarks/results/screening-outcomes-latest.json
```

### Headline comparison metrics

| Metric | Definition |
|--------|------------|
| Early-stage (I/II) rate | Share of malignant diagnoses at stage I/II |
| Treatment initiation (90d) | Diagnosed patients starting treatment within 90 days |
| Dx→treatment interval | Median days from diagnosis to treatment start |
| Simulated 5-year survival | Stage-weighted survival with treatment adjustment |
| Chronic control rate | Hypertension/diabetes reaching target control |

Reported overall and by disease category (lung / colorectal / breast cancer,
hypertension, type 2 diabetes), with intervention-vs-control deltas.

### Intervention funnel

Continuous monitoring → anomaly flag → risk stratification → exam booked →
exam completed → diagnosed & staged → treatment started (intervention arm).

> All outcomes are simulated from published parameters, not observed prospective
> results. Dashboard: `/outcomes` (requires login).

## Clinical Cohort Validation (SEER / NLST / China NCCR)

External validation against published registry and trial subsets (not full
patient-level dumps).

**Module:** `server/screening/cohortValidator.js`  
**References:** `server/screening/clinicalReferenceData.js`

```bash
npm run validate:cohort   # → benchmarks/results/clinical-validation-latest.json
```

### Validated outcomes

| Domain | Metrics |
|--------|---------|
| Early diagnosis | Stage I/II rate vs NLST stage-shift & China NCCR lung pilots |
| Treatment delay | Median dx→treatment vs SEER / NCCR benchmarks |
| 5-year survival | Intervention gain vs registry-modeled early-dx benefit |

### Diagnostic operating characteristics

| Metric | Definition |
|--------|------------|
| Sensitivity | TP / (TP + FN) — wearable risk flag vs simulated malignancy |
| Specificity | TN / (TN + FP) |
| PPV | TP / (TP + FP) |
| AUC | ROC area under curve from riskScore thresholds (intervention arm) |

### API

```bash
curl http://localhost:3001/api/research/references/clinical
curl -X POST http://localhost:3001/api/research/validate
curl http://localhost:3001/api/research/validate
```
