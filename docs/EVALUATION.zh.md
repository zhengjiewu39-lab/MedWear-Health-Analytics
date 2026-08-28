# 评测协议

> **方法对齐：** 产品引擎 = BHI（`behavioralHealthIndex.js`）+ 稳健 MAD 异常（`robustAnomaly.js`）+ `MedWear-RuleEngine-v1`。  
> 完整披露：`GET /api/methodology/transparency` · 静态文档：`npm run docs:sync` · CI 校验：`npm run docs:verify`。

## 基准数据集

**MedWear-Wearable-Analytics-Benchmark-v3** — 5000 例合成多日可穿戴案例（CC-BY-4.0），可用于 Wilson 95% CI **engine-versus-reference agreement** 估计。

### 双引擎架构（防止自评虚高）

| 角色 | 模块 | 用途 |
|------|------|------|
| 产品流水线 | `MedWear-AnalyticsCore-v1` | 应用内实时告警/异常/BHI 行为健康分层与关注信号分类 |
| 独立合成参考标注 | `independentSyntheticReference-v1` | 规则化合成参考标签（更严 SpO₂、不同评分公式） |
| 评测 | `engine-versus-reference-agreement` | 衡量分歧率，**非**引擎自标注 |

生理信号：**28% 参数随机成人场景** + **72% 表型随机场景**（含运动心率/SpO₂ 伪影/恢复日等误报场景，`seed=42`）。

产品告警采用**峰值/单点读数触发**（贴近可穿戴设备）；合成参考标签采用**规则化上下文抑制**（运动性心动过速、单次 SpO₂ 伪影、计划休息日）。

每例含 7 天步数、心率、SpO₂、HRV、睡眠；**合成参考标签** 由 `independentSyntheticReference-v1` 规则标注（与产品引擎分离，**非**临床医生裁决）：

- 预期告警类型
- 是否存在异常（二分类）
- BHI 关注分层（低 / 中 / 高）
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
| BHI 分层一致率 | BHI 行为健康分层（`bhiWatchTier`）三分类一致率 |
| 评分一致 | BHI 与合成参考值相差 ≤8 分（`healthScore` 字段 = BHI） |
| 95% CI | Wilson 区间（n≥100 时可用于报告） |

## 主基准范围

**MedWear-Wearable-Analytics-Benchmark-v3** · n=5000 · seed=42 · 产品引擎：**MedWear-AnalyticsCore-v1** · 独立参考：**independentSyntheticReference-v1** · 评测：**engine-versus-reference agreement**。

**直接评测：** 固定阈值告警、MAD 异常输出、BHI（提供 prior days 时含趋势调整）、BHI 关注分层。

**不直接评测：** 领域加权 RuleEngine 研究信号整合输出；探索性队列/情景模拟模块；可选 ONNX 后端。

独立合成参考标签为**规则生成的合成参考标签** — **非**临床 ground truth。

±8 分 BHI 一致标准为**预设的启发式基准容差**，非经临床验证的等效界值。

探索性筛查/结局模拟模块见 [METHODS.zh.md](./METHODS.zh.md) 中“不在稿件主范围”说明。

## 参考结果（v3.0，n=5000，seed=42，BHI + MAD 引擎）

运行 `npm run evaluate` 获取当前数值。示例（产品引擎 vs **independentSyntheticReference-v1** 独立合成参考标签 — engine-versus-reference agreement）：

| 指标 | 数值 | 95% CI |
|------|------|--------|
| 告警 F1 | 0.854 | — |
| 告警精确率 | 0.772 | — |
| 告警召回率 | 0.956 | — |
| 异常准确率 | 0.694 | 0.681–0.707 |
| BHI 分层一致率 | 0.760 | 0.748–0.772 |
| BHI 一致（±8 分） | 0.701 | 0.688–0.713 |

分歧：**3151 / 5000** 例在至少一项任务上与合成参考标签不一致。

告警精确率 &lt; 1 表示存在 realistic 误报（运动峰值心率、单次 SpO₂ 下跌、恢复日步数偏低）；合成参考标签经规则化上下文抑制，非产品自评。

## API 评测

```bash
curl -X POST http://localhost:3001/api/research/evaluate
curl http://localhost:3001/api/research/results
```

## 后续工作

- 在 v3 生成器内扩展边界案例（缺失传感器、稀疏数据等）
- 与朴素基线对比（人群固定阈值）
- 公开数据集启发代理健全性检查（WESAD 启发 stress 代理、PPG-DaLiA 计划中）— 非外部验证
- 探索性研究信号模块的参考域映射审阅（不在主基准范围内）

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

持续监测 → 异常标记 → 关注信号分层 → 预约体检 → 完成体检 →
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
| 灵敏度 | TP / (TP + FN) — 规则引擎标记 vs 模拟结局标签 |
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
| False-positive alerts | 151 |
| Est. follow-up workups (35% of FP) | 53 |
| Est. extra outpatient visits | 63.6 |
| Alert precision (eval) | 0.7718 |

## 规则引擎 vs 简单 ML — 公平比较（原始可穿戴特征）

> **主表：** 15 维导出，**不含** BHI/异常标记。规则引擎因**可解释与可审计**优先，而非 oracle sklearn 准确率。`npm run experiment:compare-fair`。

| Model | BHI tier agreement / Macro F1 | Notes |
|-------|---------------------------------|-------|
| Rule engine (vs synthetic reference) | BHI tier 0.76, alert F1 0.8542 | product metric |
| majority-class | acc 0.5122, F1 0.2258 | node baseline |
| hr-steps-heuristic | acc 0.5032, F1 0.4511 | node baseline |
| lr (sklearn, fair) | acc 0.9390000000000001, F1 0.938260223082613 | 5-fold CV, raw features |
| dt (sklearn, fair) | acc 0.9410000000000001, F1 0.9392945829877892 | 5-fold CV, raw features |
| rf (sklearn, fair) | acc 0.9586, F1 0.9562394174159635 | 5-fold CV, raw features |

> **公平 ML 说明：** sklearn 目标为**产品引擎 BHI 关注分层**（非合成参考标签）。5-fold CV 为同导出集上的随机分层分割。高准确率反映合成数据上的**特征可区分性上限** — **非**独立临床验证。规则引擎因可解释性优先，而非 oracle 特征上 sklearn 更差。

### 附录：oracle 比较（含引擎衍生特征 — 特征泄露）

> 含 `health_score_norm` + `anomaly_flag`。sklearn CV 高（~0.94–0.98）**非**独立验证。`npm run experiment:compare-oracle`。

| Model | Accuracy / Macro F1 | Notes |
|-------|---------------------|-------|
| lr (sklearn, oracle) | acc 0.9471999999999999, F1 0.9385634156470202 | appendix only |
| dt (sklearn, oracle) | acc 0.9762000000000001, F1 0.9729773375259132 | appendix only |
| rf (sklearn, oracle) | acc 0.9852000000000001, F1 0.9827387082115269 | appendix only |

### 参考分层 ML 对比（independentSyntheticReference-v1 标签）

> sklearn 预测**合成参考 BHI 关注分层**（原始特征）。`npm run experiment:compare-vs-reference`。

| Model | Reference-tier agreement / Macro F1 | Notes |
|-------|-------------------------------------|-------|
| Rule engine (engine-versus-reference) | 0.76, alert F1 0.8542 | product vs independent synthetic reference |
| majority-class | acc 0.6328, F1 0.2584 | node baseline |
| lr (sklearn, vs reference) | acc 0.9469999999999998, F1 0.9385803982951801 | 5-fold CV, reference label target |
| dt (sklearn, vs reference) | acc 0.9693999999999999, F1 0.9670046819306586 | 5-fold CV, reference label target |
| rf (sklearn, vs reference) | acc 0.9848000000000001, F1 0.9820846830849433 | 5-fold CV, reference label target |

## 参数敏感性（结局模拟）

> 结局高度依赖参数 — `npm run sensitivity:outcomes` 生成 tornado。

| Parameter perturbation | Metric | Baseline | Perturbed | Δ |
|------------------------|--------|----------|-----------|---|
| STAGE_DISTRIBUTION.intervention (I +15%) | earlyStageRate (intervention, analytical) | 0.75 | 0.8045 | 0.0545 |
| TREATMENT_INITIATION_RATE.intervention (+10%) | treatmentInitiationRate (intervention) | 0.92 | 0.99 | 0.07 |
| CHRONIC_CONTROL_RATE.intervention (+8%) | chronicControlRate (intervention) | 0.74 | 0.7992 | 0.0592 |
| simulated 5y survival headline (frozen cohort) | survival5y.absoluteDelta | 0.2464 | 0.2464 | 0 |

## 可移植特征 / 公开数据集启发代理健全性检查

> 17 维导出特征描述性检查。WESAD 行为 **public-dataset-inspired proxy sanity check** — 非外部验证。见 [EXTERNAL-VALIDATION.zh.md](./EXTERNAL-VALIDATION.zh.md)。

- WESAD-inspired proxy (**sanity check only — not external validation**): n=120 · subjects=15 · BHI-tier acc=0.5583 (holdout n=24 acc=0.5833) · per-subject acc range=0.375–0.875 · featureBuildUsesLabels=false
- WESAD proxy AUC (supplement only — may reflect proxy separability, not generalization): full=0.9936 · holdout=0.9792 · 95% CI 0.9214–1
- Internal export: n=5000 · BHI-tier acc=0.767
- Planned external: PPG-DaLiA (activity HR proxy)

<!-- EVAL-SUPPLEMENT-END -->
