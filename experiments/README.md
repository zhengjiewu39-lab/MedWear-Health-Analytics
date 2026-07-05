# ML Experiments Pipeline

Node.js exports wearable features from `server/services/extractFeatures.js`.
Python trains risk-stratification models on exported CSV.

## Quick start

```bash
npm run export:features
npm run generate:synth-health -- --users 200 --days 14

node scripts/export_features.js --input experiments/data/medwear/synth_n200.json --out experiments/data/medwear/features_synth.csv

pip install -r experiments/medwear/requirements.txt
python experiments/medwear/train.py --data experiments/data/medwear/features_v1.csv --model rf --cv 5
python experiments/medwear/evaluate.py --results experiments/results --out experiments/results/summary.csv
```

## Synthetic health data

- `scripts/generate_synthetic_healthdata.js` — primary generator (JSON + sample ZIP)
- `health-import/generate_synthetic_healthdata.py` — Python wrapper invoking the same manifest format

## Output layout

```
experiments/
  data/medwear/features_v1.csv
  data/medwear/synth_n200.json
  data/medwear/synth_user_001.json
  data/medwear/synth_user_001.zip
  results/
  medwear/train.py
  medwear/evaluate.py
  medwear/notebooks/medwear_experiments.ipynb
```
