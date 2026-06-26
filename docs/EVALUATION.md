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
