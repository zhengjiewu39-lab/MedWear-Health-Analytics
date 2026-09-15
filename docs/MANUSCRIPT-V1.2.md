# MedWear manuscript v1.2 frozen analysis

Tag: `medwear-manuscript-v1.2`

The v1.2 freeze adds a public, deterministic secondary-analysis path while leaving the primary
MedWear-AnalyticsCore-v1 rules and the n=5000 seed-42 benchmark results unchanged.

## Reproduce

```bash
npm run generate:benchmark
npm run test:server
npm run evaluate
npm run analyze:manuscript-secondary
```

Primary output: `benchmarks/results/latest.json`  
Frozen secondary output: `benchmarks/results/manuscript-secondary-v1.2.json`

The secondary script reports:

- BHI absolute-difference tolerance sensitivity at ±5, ±8, ±10 and ±12 points;
- mean signed difference, mean absolute difference, median absolute difference and IQR;
- descriptive Bland–Altman mean difference and 95% limits of agreement;
- score-dependent difference diagnostics by pairwise-mean band and correlation summaries;
- a rule-path audit of independent-reference-positive/MedWear-negative MAD cases.

These outputs describe agreement between two deterministic computational implementations. They do
not estimate clinical measurement error, clinical validity, diagnostic performance or clinical
interchangeability.

## Naming cleanup

The independent reference implementation is stored as
`server/services/independentSyntheticReference.js`. Legacy clinical/gold-standard names are not used
in the v1.2 benchmark-generation or manuscript-analysis paths.
