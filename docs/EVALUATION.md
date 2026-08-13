# Evaluation Protocol

> **Methods alignment:** Product engine = BHI (`behavioralHealthIndex.js`) + robust MAD anomalies (`robustAnomaly.js`) + `MedWear-RuleEngine-v1`.  
> Full disclosure: `GET /api/methodology/transparency` · regenerate static docs: `npm run docs:sync` · CI check: `npm run docs:verify`.

## Benchmark Dataset

**MedWear-Wearable-Analytics-Clinical-v2** — 5000 synthetic multi-day wearable cases (CC-BY-4.0). Suitable for **engine-vs-gold agreement estimation** with 95% Wilson CIs.

### Dual-engine architecture (prevents self-test inflation)

| Role | Module | Purpose |
|------|--------|---------|
| Product pipeline | `MedWear-AnalyticsCore-v1` | Live alerts, anomaly, BHI watch-tier / attention-signal classification in the app |
| Benchmark gold | `clinicalGoldStandard-v1` | Independent labels (stricter SpO₂, different score formula) |
| Evaluation | `engine-vs-gold-agreement` | Measures disagreement — **not** engine self-labeling |

Physiology: **28% clinical-random adults** + **72% phenotype-random synthesis** (`seed=42`), including exercise/SpO₂-artifact/rest-day false-positive scenarios.

Product alerts use **peak/single-reading sensitivity** (wearable-style); gold labels apply **contextual clinical suppression** (exercise tachycardia, motion SpO₂ artifact, planned rest day).

Each case includes 7 days of steps, HR, SpO2, HRV, sleep with **reference gold labels** (independent adjudication — evaluation measures **inter-engine consistency**):

- Expected alert types
- Anomaly presence (binary)
- Risk tier (low / moderate / high)
- Minimum acceptable BHI (`healthScore` field — behavioral health index)

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
| Alert F1 | Micro-F1 over alert type sets (precision/recall also reported) |
| Anomaly Accuracy | Binary match on anomalyDetected |
| Risk Accuracy | 3-class BHI watch-tier match on bhiWatchTier |
| Score agreement | BHI within ±8 pts of gold reference (`healthScore` field = BHI) |
| 95% CI | Wilson score interval for accuracy metrics (n≥100) |

## Reference Results (v2.5, n=5000, seed=42, BHI + MAD engine)

Run `npm run evaluate` for current numbers. Example (product engine vs **clinicalGoldStandard-v1** reference labels — engine-vs-gold agreement):

| Metric | Value | 95% CI |
|--------|-------|--------|
| Alert F1 | 0.844 | — |
| Alert precision | 0.758 | — |
| Alert recall | 0.953 | — |
| Anomaly accuracy | 0.700 | 0.688–0.713 |
| Risk accuracy (BHI watch tiers) | 0.787 | 0.775–0.798 |
| BHI agreement (±8 pts) | 0.760 | 0.748–0.772 |

Disagreements: **3041 / 5000** cases differ on at least one task (alert set, anomaly, risk, or BHI).

Alert precision &lt; 1 reflects realistic wearable false positives (exercise HR peaks, single SpO₂ dips, recovery-day low steps). Gold labels use contextual adjudication — not the product engine.

Gold labels use stricter SpO₂/activity cutoffs and a separate reference BHI formula — not the product engine. Metrics ≥98% on all tasks indicate circular labels and invalid **agreement estimation**.

## API Evaluation

```bash
curl -X POST http://localhost:3001/api/research/evaluate
curl http://localhost:3001/api/research/results
```

## Future Work

- Expand edge cases (missing sensors, sparse data) within v2 generator
- Compare against naive baselines (population fixed thresholds)
- Public-dataset-inspired proxy sanity checks (WESAD-inspired stress proxy, PPG-DaLiA planned) — not external validation
- Clinician review of screening category mappings

---

## Exploratory Scenario Simulation (Screened vs Unscreened)

**Exploratory scenario simulation framework** — not prospective validation. Demonstrates how preset arm parameters (stage distribution, treatment rates, survival tables) produce intervention-vs-control deltas under conservative / neutral / optimistic sensitivity scenarios.

Results are **highly parameter-driven** — for methodology demonstration and sensitivity analysis only (no p-values). See `GET /api/methodology/transparency` → `cohortSimulation` and `GET /api/outcomes/scenarios`.

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
> results. Intended for transparency demos and sensitivity analysis — do not report as proven clinical benefit. Dashboard: `/outcomes` (requires login).

## Published Reference Comparison (SEER / NLST / China NCCR)

**Illustrative benchmark comparison** against published registry and trial statistics — not prospective patient-level validation and **not** inferential hypothesis testing (no p-values).

**Module:** `server/screening/cohortValidator.js`  
**References:** `server/screening/clinicalReferenceData.js`

```bash
npm run validate:cohort   # → benchmarks/results/clinical-validation-latest.json
```

### Compared metrics (reference anchors)

| Domain | Metrics |
|--------|---------|
| Early diagnosis | Stage I/II rate vs NLST stage-shift & China NCCR lung pilots |
| Treatment delay | Median dx→treatment vs SEER / NCCR benchmarks |
| 5-year survival | Intervention gain vs registry-modeled early-dx benefit |

### Diagnostic operating characteristics

| Metric | Definition |
|--------|------------|
| Sensitivity | TP / (TP + FN) — rule-derived flag versus simulated outcome label |
| Specificity | TN / (TN + FP) |
| PPV | TP / (TP + FP) |
| AUC | ROC area under curve from riskScore thresholds (intervention arm) |

### API

```bash
curl http://localhost:3001/api/research/references/clinical
curl -X POST http://localhost:3001/api/research/validate
curl http://localhost:3001/api/research/validate
```

---

<!-- EVAL-SUPPLEMENT-START -->
## Frozen scenario sensitivity (conservative / neutral / optimistic)

> Parameter-driven exploratory simulation — no p-values. Regenerate: `npm run freeze:scenarios`.

| Scenario | Early dx Δ | Treatment Δ | 5y survival Δ |
|----------|------------|-------------|---------------|
| conservative | 0.2348 | 0.1483 | 0.1602 |
| neutral | 0.3612 | 0.2281 | 0.2464 |
| optimistic | 0.4515 | 0.2851 | 0.308 |

## False-positive downstream burden (scenario)

> Illustrative — not observed utilization. Regenerate: `npm run analyze:fp-burden`.

| Per 1000 individuals | Value |
|----------------------|-------|
| False-positive alerts | 154 |
| Est. follow-up workups (35% of FP) | 54 |
| Est. extra outpatient visits | 64.8 |
| Alert precision (eval) | 0.7576 |

## Rule engine vs simple ML — fair comparison (raw wearable features)

> **Primary table:** 15-dim export **without** BHI/anomaly flags. Rule engine preferred for **interpretability & auditability**, not oracle sklearn accuracy. Regenerate: `npm run experiment:compare-fair`.

| Model | BHI tier accuracy / Macro F1 | Notes |
|-------|------------------------------|-------|
| Rule engine (vs clinical gold) | risk 0.787, alert F1 0.8441 | product metric |
| majority-class | acc 0.5416, F1 0.2342 | node baseline |
| hr-steps-heuristic | acc 0.5114, F1 0.4558 | node baseline |
| lr (sklearn, fair) | acc 0.9358000000000001, F1 0.9281274479488534 | 5-fold CV, raw features |
| dt (sklearn, fair) | acc 0.9334, F1 0.9237003603134115 | 5-fold CV, raw features |
| rf (sklearn, fair) | acc 0.9592, F1 0.9504472811020424 | 5-fold CV, raw features |

> **Fair ML note:** Sklearn targets are **product-engine BHI watch tiers** (not gold labels). 5-fold CV uses random stratified splits on the same synthetic export. High accuracy reflects **feature distinguishability ceiling** on correlated synthetic data — **not** independent clinical validation. Rule engine is preferred for interpretability, not because sklearn "loses" on oracle features.

### Appendix: oracle comparison (engine-derived features — feature leakage)

> Includes `health_score_norm` + `anomaly_flag`. High sklearn CV (~0.94–0.98) is **not** independent validation. `npm run experiment:compare-oracle`.

| Model | Accuracy / Macro F1 | Notes |
|-------|---------------------|-------|
| lr (sklearn, oracle) | acc 0.9446, F1 0.9364173036358509 | appendix only |
| dt (sklearn, oracle) | acc 0.9827999999999999, F1 0.9794665527307297 | appendix only |
| rf (sklearn, oracle) | acc 0.9858, F1 0.9834401404422785 | appendix only |

### Gold-tier ML comparison (clinicalGoldStandard-v1 labels)

> Sklearn trained to predict **reference tier** from raw features. Regenerate: `npm run experiment:compare-vs-gold`.

| Model | Gold-tier accuracy / Macro F1 | Notes |
|-------|-------------------------------|-------|
| Rule engine (engine-vs-gold) | 0.787, alert F1 0.8441 | product vs gold reference |
| majority-class | acc 0.6432, F1 0.261 | node baseline |
| lr (sklearn, vs gold) | acc 0.9474, F1 0.93925697992577 | 5-fold CV, gold label target |
| dt (sklearn, vs gold) | acc 0.9715999999999999, F1 0.9682518572606396 | 5-fold CV, gold label target |
| rf (sklearn, vs gold) | acc 0.9872, F1 0.9841347841015973 | 5-fold CV, gold label target |

## Parameter sensitivity (outcome simulation)

> Outcomes highly parameter-driven — tornado from `npm run sensitivity:outcomes`.

| Parameter perturbation | Metric | Baseline | Perturbed | Δ |
|------------------------|--------|----------|-----------|---|
| STAGE_DISTRIBUTION.intervention (I +15%) | earlyStageRate (intervention, analytical) | 0.75 | 0.8045 | 0.0545 |
| TREATMENT_INITIATION_RATE.intervention (+10%) | treatmentInitiationRate (intervention) | 0.92 | 0.99 | 0.07 |
| CHRONIC_CONTROL_RATE.intervention (+8%) | chronicControlRate (intervention) | 0.74 | 0.7992 | 0.0592 |
| simulated 5y survival headline (frozen cohort) | survival5y.absoluteDelta | 0.2464 | 0.2464 | 0 |

## Portable feature / public-dataset-inspired proxy sanity checks

> Descriptive check on exported 17-dim rows. WESAD row is a **public-dataset-inspired proxy sanity check** — not external validation. See [EXTERNAL-VALIDATION.md](./EXTERNAL-VALIDATION.md).

- WESAD-inspired proxy (**sanity check only — not external validation**): n=120 · subjects=15 · BHI-tier acc=0.5583 (holdout n=24 acc=0.5833) · per-subject acc range=0.375–0.875 · featureBuildUsesLabels=false
- WESAD proxy AUC (supplement only — may reflect proxy separability, not generalization): full=0.9936 · holdout=0.9792 · 95% CI 0.9214–1
- Internal export: n=5000 · BHI-tier acc=0.7932
- Planned external: PPG-DaLiA (activity HR proxy)

<!-- EVAL-SUPPLEMENT-END -->
