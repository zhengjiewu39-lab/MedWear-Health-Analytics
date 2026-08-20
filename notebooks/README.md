# MedWear Paper Reproduction Notebooks

## One-click pipeline (`paper_reproduction.ipynb`)

End-to-end reproducible flow (seed=42):

1. Generate synthetic benchmark cases (`npm run generate:benchmark`)
2. Compute **BHI** (behavioral health index) + watch tier
3. Trigger **MAD** robust anomaly heuristic
4. **ONNX** local inference (`medwear_rf.onnx`)
5. **XAI** charts (BHI components, MAD baseline, SHAP feature attribution)

### Prerequisites

- Node.js 18+ and `npm ci` at repo root
- Python 3.9+

### Run locally

```bash
cd /path/to/MedWear-Health-Analytics
npm ci
python3 -m pip install -r notebooks/requirements.txt
jupyter notebook notebooks/paper_reproduction.ipynb
```

Or execute headless:

```bash
jupyter nbconvert --to notebook --execute notebooks/paper_reproduction.ipynb --output paper_reproduction_executed.ipynb
```

### Colab / GitHub Codespaces

1. Clone repo and run `npm ci`
2. Upload or mount `server/ai/models/medwear_rf.onnx` (included in repo)
3. Install `notebooks/requirements.txt` and open the notebook
