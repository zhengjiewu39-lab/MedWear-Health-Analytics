# External Dataset Validation Plan

MedWear’s primary benchmark is **internal synthetic** (`MedWear-Wearable-Analytics-Clinical-v2`, n=5000) with independent gold labels. For SCI-grade generalizability, we provide a **portable 17-dimensional feature export** (`npm run experiment:export`) that mirrors the schema used by `experiments/medwear/train.py`.

## Current baseline (in-repo)

```bash
npm run experiment:export      # benchmarks → experiments/data/medwear/features_v1.csv
npm run evaluate:external      # → benchmarks/results/external-descriptive-latest.json
```

Reports descriptive label distribution and heuristic BHI-tier accuracy on the exported rows — **not** a substitute for full external validation.

## Planned public dataset adapters

| Dataset | Signal overlap | Adapter status |
|---------|----------------|----------------|
| **WESAD** | HR, activity/stress proxy | Planned — requires download + consent-compliant subset |
| **PPG-DaLiA** | HR under activity | Planned — PPG/IMU feature mapping |
| **MIMIC-III wearable subsets** | SpO₂, HR (ICU) | Future — different population |

Adapters should map to `server/services/extractFeatures.js` column names so rule-engine and sklearn baselines can be rerun without code forks.

## Reporting guidance

When citing external runs:

1. State population and label definition (not identical to MedWear gold standard).
2. Report **descriptive** performance only unless independent adjudication exists.
3. Do not merge internal synthetic metrics with external numbers without clear separation.

See [EVALUATION.md](./EVALUATION.md) supplement section (auto-synced via `npm run evaluate:supplement`).
