# Evaluation Protocol

## Benchmark Dataset

**MedWear-Wearable-Analytics-Mini-v1** — 8 synthetic multi-day wearable cases (CC-BY-4.0).

Each case includes 7 days of steps, HR, SpO2, HRV, sleep with expert labels for:

- Expected alert types
- Anomaly presence (binary)
- Risk tier (low / moderate / high)
- Minimum acceptable health score

File: `benchmarks/wearable-analytics-dataset.json`

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

## Reference Results (v1, n=8)

Run `npm run evaluate` for current numbers. Expected strong performance on rule-based pipeline since labels align with implemented thresholds.

## API Evaluation

```bash
curl -X POST http://localhost:3001/api/research/evaluate
curl http://localhost:3001/api/research/results
```

## Future Work

- Expand to 50+ cases with edge cases (missing sensors, sparse data)
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
