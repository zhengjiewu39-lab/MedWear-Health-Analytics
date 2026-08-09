# Changelog

All notable methodology and documentation changes for MedWear Health Analytics.

## [0.1.0] — 2026-08-09

### Methodology (BHI + MAD honest refactor)

- Replaced discrete composite health score with **Behavioral Health Index (BHI)** (`behavioralHealthIndex.js`).
- Replaced mean + 2σ anomalies with **robust MAD heuristic** + activity context filter (`robustAnomaly.js`).
- Renamed AI layer to **`MedWear-RuleEngine-v1`** — removed fake ensemble accuracies and CardioNet-style claims.
- API field `healthScore` retained for compatibility; documented as **BHI** via `scoreKind` / `scoreLabel` / `GET /api/methodology/transparency`.

### Evaluation

- Wearable benchmark expanded to **n=5000** with independent `clinicalGoldStandard-v1` labels.
- Realistic alert false positives (v2.5): alert F1 **~0.844**, precision **~0.758**, anomaly accuracy **~0.700**, BHI agreement **~0.760** (seed=42).
- Added **false-positive burden** scenario (`npm run analyze:fp-burden`).
- Frozen **scenario sensitivity** conservative/neutral/optimistic (`npm run freeze:scenarios`).
- **Rule engine vs sklearn** comparison on exported features (`npm run experiment:compare`).
- Portable feature descriptive baseline for external dataset adapters (`npm run evaluate:external`).

### Documentation & transparency

- Single source of truth: `server/config/methodologyTransparency.js` → `npm run docs:sync` + CI `npm run docs:verify`.
- Cohort simulation reframed as **exploratory, parameter-driven** (no p-values).
- EN/ZH parity for METHODS, EVALUATION supplement sections, README, PROJECT-OVERVIEW, ETHICS.

### Engineering

- Electron mac category: `healthcare-fitness` (research prototype).
- Default credentials flagged as **local demo only** in README, ETHICS, startup scripts.
- `GET /api/research/evaluation-supplement` for frozen benchmark artifacts.

### Removed / deprecated claims

- Personal-baseline 2σ anomaly detection (docs + product path).
- Declared ML validation accuracies / ensemble confidence caps.
- Strong “thesis validation” framing for cohort outcomes.
