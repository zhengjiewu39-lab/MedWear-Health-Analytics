# 评测协议

> **方法对齐：** 产品引擎 = BHI（`behavioralHealthIndex.js`）+ 稳健 MAD 异常（`robustAnomaly.js`）+ `MedWear-RuleEngine-v1`。  
> 完整披露：`GET /api/methodology/transparency` · 静态文档：`npm run docs:sync` · CI 校验：`npm run docs:verify`。

## 基准数据集

**MedWear-Wearable-Analytics-Clinical-v2** — 5000 例合成多日可穿戴案例（CC-BY-4.0），可用于 Wilson 95% CI 临床性能估计。

### 双引擎架构（防止自评虚高）

| 角色 | 模块 | 用途 |
|------|------|------|
| 产品流水线 | `MedWear-AnalyticsCore-v1` | 应用内实时告警/异常/风险 |
| 基准金标准 | `clinicalGoldStandard-v1` | 独立标注（更严 SpO₂、不同评分公式） |
| 评测 | `engine-vs-gold-agreement` | 衡量分歧率，**非**引擎自标注 |

生理信号：**28% 临床随机成人** + **72% 表型随机**（含运动心率/SpO₂ 伪影/恢复日等误报场景，`seed=42`）。

产品告警采用**峰值/单点读数触发**（贴近可穿戴设备）；金标准采用**临床上下文抑制**（运动性心动过速、单次 SpO₂ 伪影、计划休息日）。

每例含 7 天步数、心率、SpO₂、HRV、睡眠；**临床金标准** 由 `clinicalGoldStandard-v1` 裁决（与产品引擎分离）：

- 预期告警类型
- 是否存在异常（二分类）
- 风险等级（低 / 中 / 高）
- 健康评分下限（BHI，`healthScore` 字段）

文件：`benchmarks/wearable-analytics-dataset.json`  
原始 8 例种子：`benchmarks/wearable-analytics-seed-v1.json`

**重新生成（可复现，seed=42）：**

```bash
npm run generate:benchmark
```

## 运行评测

```bash
npm run test:server
npm run evaluate
```

输出：`benchmarks/results/latest.json`

## 指标

| 指标 | 定义 |
|------|------|
| 告警 F1 | 告警类型集合 micro-F1（同时报告精确率/召回率） |
| 异常准确率 | `anomalyDetected` 二分类一致率 |
| 风险准确率 | `riskLevel` 三分类一致率 |
| 评分一致 | BHI 与金标准参考值相差 ≤8 分（`healthScore` 字段 = BHI） |
| 95% CI | Wilson 区间（n≥100 时可用于临床报告） |

## 参考结果（v2.5，n=5000，seed=42，BHI + MAD 引擎）

运行 `npm run evaluate` 获取当前数值。示例（产品引擎 vs **clinicalGoldStandard-v1**）：

| 指标 | 数值 | 95% CI |
|------|------|--------|
| 告警 F1 | 0.844 | — |
| 告警精确率 | 0.758 | — |
| 告警召回率 | 0.953 | — |
| 异常准确率 | 0.700 | 0.688–0.713 |
| 风险准确率（BHI 分层） | 0.787 | 0.775–0.798 |
| BHI 一致（±8 分） | 0.760 | 0.748–0.772 |

分歧：**3041 / 5000** 例在至少一项任务上与金标准不一致。

告警精确率 &lt; 1 表示存在 realistic 误报（运动峰值心率、单次 SpO₂ 下跌、恢复日步数偏低），金标准经临床上下文裁决，非产品自评。

## API 评测

```bash
curl -X POST http://localhost:3001/api/research/evaluate
curl http://localhost:3001/api/research/results
```

## 后续工作

- 在 v2 生成器内扩展边界案例（缺失传感器、稀疏数据等）
- 与朴素基线对比（人群固定阈值）
- 在公开可穿戴数据集上交叉验证（WESAD、PPG-DaLiA 子集等）
- 临床专家对筛查类别映射的审阅

---

## 探索性情景模拟（筛查组 vs 对照组）

**探索性情景模拟框架** — 非前瞻性验证。展示预设组间参数（分期分布、治疗率、存活表）如何在保守 / 中性 / 乐观敏感性情景下产生干预 vs 对照差异。

结果**高度依赖预设参数** — 仅用于方法论演示与敏感性分析（无 p 值）。见 `GET /api/methodology/transparency` → `cohortSimulation` 与 `GET /api/outcomes/scenarios`。

**数据集：** `benchmarks/screening-outcome-dataset.json`
（`MedWear-Screening-Outcome-Cohort-v1`，CC-BY-4.0）— 5000 例合成患者、
双组（干预 = 可穿戴早筛；常规医疗 = 对照）、确定性种子。生理指标锚定成人合理范围；
分期 5 年存活率参考登记统计（如 SEER）；筛查降期效应参考已发表筛查试验（如 NLST）。

**生成 / 评测：**

```bash
npm run generate:cohort      # → benchmarks/screening-outcome-dataset.json
npm run evaluate:outcomes    # → benchmarks/results/screening-outcomes-latest.json
```

### 核心对比指标

| 指标 | 定义 |
|------|------|
| 早期（I/II 期）占比 | 恶性诊断中 I/II 期比例 |
| 90 天内治疗启动率 | 确诊后 90 天内开始治疗的比例 |
| 确诊→治疗间隔 | 中位天数 |
| 模拟 5 年存活率 | 分期加权存活 + 治疗调整 |
| 慢病控制率 | 高血压/糖尿病达标控制比例 |

按疾病类别（肺/结直肠/乳腺癌、高血压、2 型糖尿病）报告，并给出干预组 vs 对照组差值。

### 干预漏斗

持续监测 → 异常标记 → 风险分层 → 预约体检 → 完成体检 →
确诊分期 → 启动治疗（干预组）。

> 所有结局均由已发表参数模拟，非前瞻性观察结果。仅用于透明度演示与敏感性分析 — 不可作为已证实的临床获益。仪表盘：`/outcomes`（需登录）。

## 已发表参考对比（SEER / NLST / 中国 NCCR）

**说明性基准对比** — 对照已发表登记与试验统计，非前瞻性患者级验证，**非**推断性假设检验（无 p 值）。

**模块：** `server/screening/cohortValidator.js`  
**参考文献：** `server/screening/clinicalReferenceData.js`

```bash
npm run validate:cohort   # → benchmarks/results/clinical-validation-latest.json
```

### 对比指标（参考锚点）

| 领域 | 指标 |
|------|------|
| 早诊 | I/II 期率 vs NLST 降期 & 中国 NCCR 肺癌试点 |
| 治疗延迟 | 确诊→治疗中位数 vs SEER / NCCR 基准 |
| 5 年存活 | 干预增益 vs 登记模型早诊获益 |

### 诊断运行特征

| 指标 | 定义 |
|------|------|
| 灵敏度 | TP / (TP + FN) — 可穿戴风险标记 vs 模拟恶性 |
| 特异度 | TN / (TN + FP) |
| 阳性预测值 | TP / (TP + FP) |
| AUC | riskScore 阈值 ROC 曲线下面积（干预组） |

### API

```bash
curl http://localhost:3001/api/research/references/clinical
curl -X POST http://localhost:3001/api/research/validate
curl http://localhost:3001/api/research/validate
```

---

<!-- EVAL-SUPPLEMENT-START -->
## 固化情景敏感性（conservative / neutral / optimistic）

> 参数驱动的探索性模拟 — 无 p 值。重新生成：`npm run freeze:scenarios`。

| Scenario | Early dx Δ | Treatment Δ | 5y survival Δ |
|----------|------------|-------------|---------------|
| conservative | 0.2348 | 0.1483 | 0.1602 |
| neutral | 0.3612 | 0.2281 | 0.2464 |
| optimistic | 0.4515 | 0.2851 | 0.308 |

## 假阳性下游负担（情景估算）

> 说明性估算 — 非真实利用数据。重新生成：`npm run analyze:fp-burden`。

| Per 1000 individuals | Value |
|----------------------|-------|
| False-positive alerts | 154 |
| Est. follow-up workups (35% of FP) | 54 |
| Est. extra outpatient visits | 64.8 |
| Alert precision (eval) | 0.7576 |

## 规则引擎 vs 简单 ML — 公平比较（原始可穿戴特征）

> **主表：** 15 维导出，**不含** BHI/异常标记。规则引擎因**可解释与可审计**优先，而非 oracle sklearn 准确率。`npm run experiment:compare-fair`。

| Model | BHI tier accuracy / Macro F1 | Notes |
|-------|------------------------------|-------|
| Rule engine (vs clinical gold) | risk 0.787, alert F1 0.8441 | product metric |
| majority-class | acc 0.5416, F1 0.2342 | node baseline |
| hr-steps-heuristic | acc 0.5114, F1 0.4558 | node baseline |
| lr (sklearn, fair) | acc 0.9358000000000001, F1 0.9281274479488534 | 5-fold CV, raw features |
| dt (sklearn, fair) | acc 0.9334, F1 0.9237003603134115 | 5-fold CV, raw features |
| rf (sklearn, fair) | acc 0.9592, F1 0.9504472811020424 | 5-fold CV, raw features |

> **公平 ML 说明：** sklearn 目标为**产品引擎 BHI 关注分层**（非 gold 标签）。5-fold CV 为同导出集上的随机分层分割。高准确率反映合成数据上的**特征可区分性上限** — **非**独立临床验证。规则引擎因可解释性优先，而非 oracle 特征上 sklearn 更差。

### 附录：oracle 比较（含引擎衍生特征 — 特征泄露）

> 含 `health_score_norm` + `anomaly_flag`。sklearn CV 高（~0.94–0.98）**非**独立验证。`npm run experiment:compare-oracle`。

| Model | Accuracy / Macro F1 | Notes |
|-------|---------------------|-------|
| lr (sklearn, oracle) | acc 0.9446, F1 0.9364173036358509 | appendix only |
| dt (sklearn, oracle) | acc 0.9827999999999999, F1 0.9794665527307297 | appendix only |
| rf (sklearn, oracle) | acc 0.9858, F1 0.9834401404422785 | appendix only |

### Gold 分层 ML 对比（clinicalGoldStandard-v1 标签）

> sklearn 预测**参考风险分层**（原始特征）。`npm run experiment:compare-vs-gold`。

| Model | Gold-tier accuracy / Macro F1 | Notes |
|-------|-------------------------------|-------|
| Rule engine (engine-vs-gold) | 0.787, alert F1 0.8441 | product vs gold reference |
| majority-class | acc 0.6432, F1 0.261 | node baseline |
| lr (sklearn, vs gold) | acc 0.9474, F1 0.93925697992577 | 5-fold CV, gold label target |
| dt (sklearn, vs gold) | acc 0.9715999999999999, F1 0.9682518572606396 | 5-fold CV, gold label target |
| rf (sklearn, vs gold) | acc 0.9872, F1 0.9841347841015973 | 5-fold CV, gold label target |

## 参数敏感性（结局模拟）

> 结局高度依赖参数 — `npm run sensitivity:outcomes` 生成 tornado。

| Parameter perturbation | Metric | Baseline | Perturbed | Δ |
|------------------------|--------|----------|-----------|---|
| STAGE_DISTRIBUTION.intervention (I +15%) | earlyStageRate (intervention, analytical) | 0.75 | 0.8045 | 0.0545 |
| TREATMENT_INITIATION_RATE.intervention (+10%) | treatmentInitiationRate (intervention) | 0.92 | 0.99 | 0.07 |
| CHRONIC_CONTROL_RATE.intervention (+8%) | chronicControlRate (intervention) | 0.74 | 0.7992 | 0.0592 |
| simulated 5y survival headline (frozen cohort) | survival5y.absoluteDelta | 0.2464 | 0.2464 | 0 |

## 可移植特征 / 外部数据集基线

> 17 维导出特征描述性检查。WESAD 适配器已实现（仅健全性检查）。见 [EXTERNAL-VALIDATION.zh.md](./EXTERNAL-VALIDATION.zh.md)。

- WESAD stress proxy (**sanity check only — not validation**): n=120 · subjects=15 · BHI-tier acc=0.5583 (holdout n=24 acc=0.5833) · per-subject acc range=0.375–0.875 · stress-binary AUC(BHI)=0.9936 (holdout=0.9792, 95% CI 0.9214–1) · featureBuildUsesLabels=false
- Internal export: n=5000 · BHI-tier acc=0.7932
- Planned external: PPG-DaLiA (activity HR proxy)

<!-- EVAL-SUPPLEMENT-END -->
