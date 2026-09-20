# 文章对齐系统（Article follows system）

> **原则：** 以本仓库 **代码 + `npm run evaluate` 输出** 为唯一事实来源。更新 Word/LaTeX 时 **只从本文与 JSON 抄数字与表述**，不要为迁就旧稿反改系统或主基准公式。
>
> Generated: `2026-09-20T00:45:15.248Z` · Commit: [`ef86e6ae6d27e7d38a7e3fa49f1046efe67949dc`](https://github.com/zhengjiewu39-lab/MedWear-Health-Analytics/commit/ef86e6ae6d27e7d38a7e3fa49f1046efe67949dc)

---

## Data availability（建议英文稿）

```text
Repository: https://github.com/zhengjiewu39-lab/MedWear-Health-Analytics
Freeze commit: ef86e6ae6d27e7d38a7e3fa49f1046efe67949dc
Freeze tag: medwear-manuscript-v1.2.3

Primary reproduction:
  npm ci
  npm run test:server
  npm run evaluate
  npm run analyze:manuscript-secondary
  npm run docs:verify

Benchmark: benchmarks/wearable-analytics-dataset.json (n=5000, seed=42)
Engine: MedWear-AnalyticsCore-v1
Reference labels: independentSyntheticReference-v1 (synthetic reference — not clinical ground truth)
Primary alert thresholds: benchmarks/wearable-analytics-dataset.json thresholds + alertThresholds.js (SpO₂ min 93%)
Note: runtime-settings.json affects live UI only; npm run evaluate does NOT read it.
```

## Data availability（中文摘要）

- 仓库：https://github.com/zhengjiewu39-lab/MedWear-Health-Analytics，冻结 tag `medwear-manuscript-v1.2.3` · commit `ef86e6ae6d27e7d38a7e3fa49f1046efe67949dc`
- 主基准：合成队列 n=5000、seed=42；引擎 **MedWear-AnalyticsCore-v1** vs 参考 **independentSyntheticReference-v1**
- 主结果数字来源：`npm run evaluate` → `benchmarks/results/latest.json`
- 次要分析（Bland–Altman、±5/8/10/12、MAD 路径审计）：`npm run analyze:manuscript-secondary` → `manuscript-secondary.json`
- 服务端测试：**87**（`npm run test:server`）

---

## Results — Primary endpoints（Table 3 / 主表，直接抄写）

| Metric | Value | Notes |
|--------|-------|--------|
| Alert precision | 0.7718 | Threshold-signal agreement only |
| Alert recall | 0.9563 | |
| **Alert F1** | **0.8542** | Not RuleEngine domain F1 |
| Anomaly accuracy (MAD case-level) | 0.6942 | 95% CI 0.6813–0.7068 |
| BHI watch tier agreement | 0.7600 | 95% CI 0.7480–0.7716 |
| BHI score within ±8 points | 0.7006 | Heuristic software tolerance, not clinical equivalence |
| Engine–reference mismatches (case flags) | 3151 | See latest.json |
| n | 5000 | seed=42 |

**Do not report as primary:** MedWear-RuleEngine-v1 domain attentionScore F1; ONNX main-table metrics; cohort SEER/NLST simulation as diagnostic performance.

---

## Results — Secondary（来自 manuscript-secondary.json）

| Item | Value |
|------|-------|
| BHI mean difference (engine − reference) | -4.82 |
| Bland–Altman LoA | -18.13 to 8.49 |
| Within ±5 / ±8 / ±10 / ±12 points | 0.5432 / 0.7006 / 0.7744 / 0.8362 |
| MAD ref+ / MedWear− | 1494 |
| HR baseline gate (among ref+ mw−) | 1166 |
| MAD case-level agreement | 0.6942 |

---

## Methods / Discussion — 系统边界（与产品一致）

**Primary path（进主文 Results）：** Apple Health / 合成日表型 → BHI（行为健康指数，非疾病风险分）→ 固定阈值告警（SpO₂ 93% 等）→ MAD 稳健异常 → 与 **independentSyntheticReference-v1** 的 engine-versus-reference 一致率。

**Exploratory only（单独小节 / Supplement，不得写进主表）：**

- Research Signal Integration（原「筛查」UI）：domain + attentionScore，非诊断
- 合成队列结局 / SEER·NLST 参数化模拟（真实模式关闭个体生存对比 API）
- LLM 报告与 AI 干预（heuristicStrength / 人工审批）
- ONNX / sklearn 附录实验
- `validate:cohort` 登记子集探索性模拟（非临床验证）

**产品表述：** 界面与 `GET /api/methodology/transparency`、`docs/METHODS.md`、`docs/EVALUATION.md` 一致；详见 `docs/SECURITY.md`（RBAC）。

---

## 改稿工作流（你不再「改系统迁就文章」）

1. `git checkout medwear-manuscript-v1.2.3`（或 commit `ef86e6ae6d27e7d38a7e3fa49f1046efe67949dc`）
2. `npm run docs:manuscript-sync` — 刷新本文
3. `npm run evaluate` + `npm run analyze:manuscript-secondary` — 若需重算 JSON
4. 在 Word/LaTeX 中 **替换** Results 数字、Data availability、探索性模块措辞 → 以本文为准
5. `npm run docs:verify` 通过后再定稿

---

## 一键命令

```bash
npm run test:server
npm run evaluate
npm run analyze:manuscript-secondary
npm run docs:manuscript-sync
npm run docs:verify
```
