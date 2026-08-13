# External Dataset Descriptive Checks and Validation Plan

MedWear’s primary benchmark is **internal synthetic** (`MedWear-Wearable-Analytics-Clinical-v2`, n=5000) with independent gold labels. For SCI-grade generalizability, we provide a **portable 17-dimensional feature export** (`npm run experiment:export`) that mirrors the schema used by `experiments/medwear/train.py`.

## Current baseline (in-repo)

```bash
npm run experiment:export      # benchmarks → experiments/data/medwear/features_v1.csv
npm run evaluate:external      # → benchmarks/results/external-descriptive-latest.json
```

Reports descriptive label distribution and heuristic BHI-tier accuracy on exported rows — **not** a substitute for full external validation.

## Public dataset adapters

| Dataset | Signal overlap | Adapter status |
|---------|----------------|----------------|
| **WESAD** | HR, activity/stress proxy | **Implemented — descriptive sanity check only** |
| **PPG-DaLiA** | HR under activity | Planned — PPG/IMU feature mapping |
| **MIMIC-III wearable subsets** | SpO₂, HR (ICU) | Future — different population |

### WESAD (implemented — sanity check only)

- **Not disease labels:** WESAD stress/arousal labels are mapped to a binary stress proxy — they do **not** represent clinical disease outcomes.
- **Proxy signals:** Bundled adapter uses literature-calibrated synthetic HR/HRV windows (`server/adapters/publicDatasetAdapter.js`), not raw WESAD subject files.
- **No label leakage:** Feature construction (`windowToFeatures`) reads physiological signals only — labels are kept separate for evaluation.
- **Subject-wise holdout:** Metrics include a 20% subject holdout split, per-subject accuracy range, confusion matrix, and bootstrap 95% CI for stress-binary AUC.
- **Cannot substitute validation:** Results document signal-processing plausibility only — high separability may reflect proxy mapping, not generalization.

Regenerate: `npm run evaluate:external`

Adapters map to `server/services/extractFeatures.js` column names so rule-engine and sklearn baselines can be rerun without code forks.

## Reporting guidance

When citing external runs:

1. State population and label definition (not identical to MedWear gold standard).
2. Report **descriptive** performance only unless independent adjudication exists.
3. Do not merge internal synthetic metrics with external numbers without clear separation.
4. Never cite WESAD proxy AUC as clinical validation.

See [EVALUATION.md](./EVALUATION.md) supplement section (auto-synced via `npm run evaluate:supplement`).
