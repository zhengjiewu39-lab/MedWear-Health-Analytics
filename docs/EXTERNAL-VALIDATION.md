# Public-Dataset-Inspired Proxy Sanity Checks

MedWear’s primary benchmark is **internal synthetic** (`MedWear-Wearable-Analytics-Clinical-v2`, n=5000) with independent gold labels. For transparency, we also ship a **portable 17-dimensional feature export** (`npm run experiment:export`) aligned with `experiments/medwear/train.py`.

> **Terminology:** Bundled WESAD-related runs are **public-dataset-inspired proxy sanity checks** — **not** external validation, **not** WESAD validation on raw subject data.

## Current in-repo checks

```bash
npm run experiment:export      # benchmarks → experiments/data/medwear/features_v1.csv
npm run evaluate:external      # → benchmarks/results/external-descriptive-latest.json
```

Reports descriptive BHI-tier accuracy on exported rows — **not** a substitute for independent clinical validation.

## Public dataset adapters

| Dataset | Signal overlap | Status |
|---------|----------------|--------|
| **WESAD-inspired proxy** | HR, activity/stress proxy | **Implemented — proxy sanity check only** |
| **PPG-DaLiA** | HR under activity | Planned — PPG/IMU feature mapping |
| **MIMIC-III wearable subsets** | SpO₂, HR (ICU) | Future — different population |

### WESAD-inspired proxy (sanity check only)

- **Not external validation:** Uses literature-calibrated **synthetic** HR/HRV windows — not raw WESAD physiological files.
- **Not disease labels:** Stress/arousal proxy labels do **not** represent clinical disease outcomes.
- **No label leakage:** `windowToFeatures()` reads physiological signals only; labels are evaluation-only.
- **Subject-wise holdout:** 20% subject holdout, per-subject accuracy range, confusion matrix.
- **AUC caution:** Stress-binary AUC may appear very high (~0.97–0.99) due to proxy mapping separability — **do not place in abstract or main results**; supplement-only with explicit caveat.

Regenerate: `npm run evaluate:external`

Adapters map to `server/services/extractFeatures.js` column names for rule-engine / sklearn reruns.

## Reporting guidance

1. State population and label definition (not identical to MedWear gold standard).
2. Report **descriptive** performance only unless independent adjudication exists.
3. Do not merge internal synthetic metrics with proxy numbers without clear separation.
4. Never cite WESAD-inspired proxy AUC as clinical or external validation.

See [EVALUATION.md](./EVALUATION.md) supplement (auto-synced via `npm run evaluate:supplement`).
