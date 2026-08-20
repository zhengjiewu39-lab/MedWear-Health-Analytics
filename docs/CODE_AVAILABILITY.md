# Code Availability

## Repository

- **GitHub:** https://github.com/zhengjiewu39-lab/MedWear-Health-Analytics  
- **Release:** https://github.com/zhengjiewu39-lab/MedWear-Health-Analytics/releases/tag/v1.0.0  
- **License:** MIT  

## Archival DOI (Zenodo)

After enabling the [Zenodo–GitHub integration](https://docs.zenodo.org/en/latest/user-guide/github-integration/) and publishing release **v1.0.0**, Zenodo assigns a DOI. Update the placeholder below with your record URL:

- **DOI:** `10.5281/zenodo.XXXXXXXX`  
- **Zenodo record:** https://zenodo.org/record/XXXXXXXX  

### Paper text (English)

> The MedWear Health Analytics source code, synthetic benchmark generators, evaluation scripts, and reproduction notebook are openly available at https://github.com/zhengjiewu39-lab/MedWear-Health-Analytics (release v1.0.0). An archival copy is deposited on Zenodo (DOI: 10.5281/zenodo.XXXXXXXX). The repository includes `npm run evaluate` for engine-vs-gold agreement metrics, `notebooks/paper_reproduction.ipynb` for one-click pipeline reproduction (seed=42), and CI workflows verifying build and tests.

### 论文可用性声明（中文）

> MedWear 健康分析平台源代码、合成基准生成器、评测脚本及复现 Notebook 开源于 https://github.com/zhengjiewu39-lab/MedWear-Health-Analytics（版本 v1.0.0）。归档副本见 Zenodo（DOI: 10.5281/zenodo.XXXXXXXX）。仓库提供 `npm run evaluate`（引擎 vs 金标准一致率）、`notebooks/paper_reproduction.ipynb`（seed=42 一键复现）及 CI 自动验证。

## Citation

See [`CITATION.cff`](../CITATION.cff) at the repository root (GitHub renders citation hints automatically).

```bibtex
@software{wu2026medwear,
  author       = {Wu, Zhengjie},
  title        = {MedWear Health Analytics},
  year         = {2026},
  version      = {1.0.0},
  url          = {https://github.com/zhengjiewu39-lab/MedWear-Health-Analytics},
  doi          = {10.5281/zenodo.XXXXXXXX}
}
```

Replace `XXXXXXXX` with the Zenodo concept DOI suffix after the first successful archive.

## Reproduce

```bash
git clone https://github.com/zhengjiewu39-lab/MedWear-Health-Analytics.git
cd MedWear-Health-Analytics
git checkout v1.0.0
npm ci
npm run evaluate
pip install -r notebooks/requirements.txt
npm run notebook:reproduction
```
