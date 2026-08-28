# MedWear Paper Reproduction Notebooks

## One-click pipeline (`paper_reproduction.ipynb`)

### Primary manuscript path (seed=42)

1. Generate synthetic benchmark cases (`npm run generate:benchmark`)
2. Compute **BHI** (behavioral health index) with trend when prior days supplied
3. Evaluate **fixed threshold signal flags**
4. Run **individualized robust MAD** anomaly detection
5. Derive **BHI watch tier**
6. Report **engine-versus-reference evaluation metrics** (`npm run evaluate`)

### Optional experimental appendix (not primary benchmark)

- **ONNX** local inference (`medwear_rf.onnx`) when explicitly enabled
- **Transparent component charts** (BHI decomposition, MAD baseline, optional SHAP on fair 15-dim export)

> BHI = behavioral health index (not disease risk). MAD = robust heuristic (not clinical validation). ONNX is disabled by default and not part of MedWear-AnalyticsCore-v1 primary benchmark.

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
