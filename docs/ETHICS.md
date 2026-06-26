# Ethics & Responsible Use

## Purpose

MedWear is a **research and education prototype** for consumer wearable analytics. It is **not** a certified medical device (SaMD) and must not be used as the sole basis for clinical decisions.

## Data Privacy

- Apple Health data is parsed **locally** and stored in `data/health-store.json`
- No cloud upload of raw health records by default
- Optional OpenAI calls send **summarized context**, not full XML exports
- Encrypted vault (`data/health-vault.enc`) for local backup snapshots
- Audit log tracks login, import, and export actions

## Synthetic vs Real

| Surface | Data |
|---------|------|
| Demo mode | Fully synthetic — labeled in UI |
| Real mode | User-imported Apple Health only |
| ECG page | **Procedural demo waveform** — not Apple Health ECG |
| Platform API | Integration **mock** for FHIR-style demo |
| Benchmark | CC-BY-4.0 synthetic cases — safe to publish |

## Screening & AI Outputs

- Disease screening scores are **risk stratification aids**, not diagnoses
- LLM responses include non-diagnostic disclaimers
- All outputs require human clinician review in any real-world use

## Research & Citation

When citing this work in academic contexts, state clearly: prototype / decision-support, not validated clinical tool. Describe dual-mode separation and local-only privacy model. Report benchmark metrics from `npm run evaluate` with dataset version.

## Production Requirements (if extended)

- IRB approval for human subjects research
- HIPAA/GDPR compliance audit (current Compliance UI is illustrative only)
- Clinical validation study with sensitivity/specificity endpoints
- Model versioning, bias assessment, and adverse event reporting
