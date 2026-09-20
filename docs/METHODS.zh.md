# MedWear 分析引擎 — 方法学

> **自动同步（中英文一致）**自 `server/config/methodologyTransparency.js`。重新生成：`npm run docs:sync` · 校验：`npm run docs:verify`。  
> 在线 API：`GET /api/methodology/transparency` · **引擎：** BHI + 稳健 MAD 启发式 + `MedWear-RuleEngine-v1`

真实模式与基准评测使用的**透明、可复现**流水线。核心告警/异常**不使用黑盒深度学习**。  
**非旧版流水线：** 无离散三档综合健康分；无个人基线 mean + 2σ 异常规则。

## 行为健康指数（BHI）

**BHI 为行为健康指数 — 非经临床校准的疾病风险评分。**

| 组成 | 权重 | 函数 |
|------|------|------|
| steps | 28% | 见下式 |
| sleep | 24% | 见下式 |
| rhr | 20% | 见下式 |
| spo2 | 16% | 见下式 |
| hrv | 12% | 见下式 |

公式：

- 步数 (28%)：sigmoid — `1 / (1 + exp(-(steps - 5500) / 1800))`（步数分量参与时；见步数缺失与零步数说明）
- 睡眠 (24%)：高斯峰值 ~7.25 h — 估计睡眠时长 `(深睡 + REM + 浅睡) / 60` 小时；**清醒阶段不计入睡眠时长**
- 睡眠得分：`exp(-((hours - 7.25)^2) / (2 * 1.4^2))`
- 静息心率 (20%)：年龄/性别调整高斯 — 参考值 = (男 ? 62 : 65) + 0.15 × max(0, 年龄−40)；得分 `exp(-((rhr - ref)^2) / (2 * 12^2))`
- SpO₂ (16%)：logistic — `1 / (1 + exp(-(spo2 - 94) / 0.75))`
- HRV-SDNN (12%)：Apple Health `HeartRateVariabilitySDNN`（SDNN，单位 ms，**非 RMSSD**）
- SDNN 参考：`ref_sdnn(age) = max(28, 50 - 0.45 * max(0, age - 30))`
- SDNN 得分：`min(1, sdnn / ref_sdnn(age))`
- 趋势（主日评分路径）：当存在 prior 数据且至少 3 个有效 prior BHI 时，`computeDayScore()` 相对 prior 七日均值（调用方最多提供 7 个 prior 日）应用预设趋势调整，系数 0.12，调整限 ±3 分，最终 BHI [0,100]。主合成基准提供 prior days，因此评测该条件性趋势调整 BHI 路径。
- 缺失数据：对可用分量重新归一化；中位数插补敏感性见 `missingDataSensitivity()`

**API 字段：** `healthScore` = 行为健康指数（BHI）。字段名 healthScore 为向后兼容保留；数值为 BHI（行为健康指数），非经临床校准的疾病风险评分。

实现：`server/services/behavioralHealthIndex.js → analyticsCore.computeDayScore()`

**人口学缺失处理（无插补）：** 人口学依赖型 BHI 分量仅在其所需元数据可用时参与计算。 RHR 分量需要有效年龄、生理性别（M/F）及静息心率测量值。 HRV-SDNN 分量需要有效年龄及 SDNN 测量值；不要求性别。 所需元数据缺失时，该分量从当日 BHI 聚合中排除，其余有效分量权重重新归一化。 不使用年龄/性别插补、中性分数或兼容后备值。 分量不可用原因 — RHR：missing_age、missing_sex、missing_age_and_sex、missing_rhr；HRV-SDNN：missing_age、missing_sdnn。

**步数缺失与零步数说明：** 真实数据路径：`server/health/dao.js` `assembleStore` 根据日步数记录设置 `stepsRecorded` / `stepsMissing`（无此字段的基准用例仍按 `steps > 0` 视为有记录）。 `stepsMissing: true` — 当日无步数记录：步数分量省略、权重重归一化；`unavailable.steps = missing_steps_record`。 `steps > 0` — 有记录的活动量：计入 `scoreSteps(steps)`，权重 28%。 `stepsRecorded: true` 且 `steps === 0` — 有记录的真实零步数：仍计入 `scoreSteps(0)`（权重 28%）；并标记 `unavailable.steps = zero_steps_day`（透明性标记，非省略分量）。

**局限：** 未在临床结局上校准；无合并症/用药调整；仅可穿戴代理信号。

## 主基准范围（MedWear-Wearable-Analytics-Benchmark-v3）

数据集：`MedWear-Wearable-Analytics-Benchmark-v3` · n=5000 · seed=42 · 产品引擎：`MedWear-AnalyticsCore-v1` · 参考：`independentSyntheticReference-v1` · 评测：engine-versus-reference-agreement。

**评测内容：** 阈值信号输出（固定可穿戴式告警规则）；MAD 稳健异常输出；BHI 连续评分（提供 prior days 时含趋势调整）；BHI 关注分层。

**不评测：** 领域加权 RuleEngine 研究信号整合输出；探索性队列/情景模拟模块；可选 ONNX 实验后端。

独立合成参考标签为规则生成的合成参考标签，不构成临床 ground truth。

±8 分 BHI 一致标准为预设的启发式基准容差，非经临床验证的等效界值。

## 告警 {#alerts}

阈值告警（可穿戴式敏感触发）。实现：`server/services/analyticsCore.js → evaluateDayAlerts()`

- 心率偏高：日均值或任一峰值 > heartRateMax（默认 100 bpm）
- 心率偏低：日均值或任一谷值 < heartRateMin（默认 50 bpm）
- 血氧偏低：任一读数 < spo2Min（默认 93%）
- 活动量不足：步数 > 0 且 < 3000

## 异常检测 {#anomalies}

**启发式规则 — 非经临床验证的异常检测器。无多重检验校正。**

- 窗口：14 天
- 基线 HR = 非高活动日（步数 < 阈值）读数的中位数；≥3 次读数 > 中位数 + k·MAD×1.4826 则标记
- 个体 SpO₂ 基线中位数 − k·MAD（非固定 93%）
- 默认：hrMadK=2.5，spo2MadK=2，高活动过滤 ≥6500 步

### 敏感性预设

| 预设 | windowDays | hrMadK | spo2MadK | activityStepsThreshold |
|------|------------|--------|----------|------------------------|
| strict | 14 | 3 | 2.5 | 7000 |
| default | 14 | 2.5 | 2 | 6500 |
| sensitive | 7 | 2 | 1.5 | 5500 |

实现：`server/services/robustAnomaly.js → analyticsCore.detectAnomaliesFromStore()`

## BHI 关注分层（非疾病风险）

**分层标签（当前平稳/建议观察/建议重点关注）为 BHI 启发式区间 — 未在临床结局上验证。**

| 内部键 | UI 标签（中文） | BHI 区间 |
|--------|-----------------|----------|
| low | 当前平稳（BHI≥80） | ≥ 80 |
| moderate | 建议观察（BHI 60–79） | 60–79 |
| high | 建议重点关注（BHI<60） | < 60 |

实现：`server/config/bhiWatchTier.js → classifyBHIWatchTier()`

## 证据等级（A/B/C）

**A/B/C 等级为作者基于公开文献的标注 — 非外部机构独立评级。**

| 等级 | 判定规则 |
|------|----------|
| A | 国际权威指南和/或高质量随机对照试验（含大型筛查 RCT、NEJM/Lancet 级 RCT） |
| B | 前瞻性队列、验证研究或国家级指南（非最高等级 RCT 直接证据） |
| C | 专家共识、系统综述中的间接关联，或可穿戴代理信号与结局的弱关联文献 |

实现：`server/data/researchReferences.js → EVIDENCE_LEVEL_RULES + EVIDENCE_RATIONALE`

## 规则引擎（研究信号整合 — 探索性）

**探索性 — 不在稿件主范围。** 不在 MedWear-Wearable-Analytics-Benchmark-v3 主基准评测范围内 不属于稿件主要结论 非临床验证或经验证的筛查性能 非患者获益证据

**领域权重为可配置占位符 — 非训练模型投票。** `engineType: evidence-weighted-rule-engine` · 版本：`MedWear-RuleEngine-v1`。置信度上限 0.85。

| 领域 | 权重 |
|------|------|
| cardiovascular | 28% |
| vitals | 22% |
| oncology-related reference domain | 18% |
| metabolic | 16% |
| sleep | 16% |

诚实 API 字段：`overallBhiTier`、`attentionScore`、`evidenceAdjustedAttentionScore`、`signalLevel`、`heuristicSupport`、`referenceDomainLabel`、`domainWeightedSummaries`。已弃用别名（前端不展示）：overallRisk、risk、rawRisk、calibratedRisk、level、heuristicConfidence、confidence、aiModel、models、modelVotes、ensembleConfidence。

融合展示权重（wearable 0.55 / clinical 0.3 / behavioral 0.15）：原型演示用可配置展示权重 — 非学习系数，未经外部验证。

已移除声明：CardioNet-style declared accuracy；ensemble confidence clamped to 0.98；fake model validation AUC。

## 可选 ONNX 推理后端

**确定性规则化分析（BHI + MAD + 研究信号规则）为主要研究路径 — 除非显式开启，否则 ONNX 默认关闭。**

| 项 | 说明 |
|----|------|
| 开启开关 | `MEDWEAR_ENABLE_ONNX=false (default — opt-in only)` |
| 模型文件 | `server/ai/models/medwear_rf.onnx + medwear_rf.meta.json` |
| 训练脚本 | `experiments/medwear/train.py (sklearn RandomForest → skl2onnx export)` |
| 训练数据 | MedWear-Wearable-Analytics-Benchmark-v3 合成导出（n=5000, seed=42）→ scripts/export_features.js 生成 experiments/data/medwear/features_v1.csv |
| 标签目标 | BHI 关注分层（low/moderate/high）— 仅 ONNX 开启时的实验性对比展示；不参与领域关注分数 |
| 运行时 | onnxruntime-node via server/ai/onnxInference.js |
| 用于 | runFullAnalysis() when MEDWEAR_ENABLE_ONNX=true — experimentalBhiTierComparison field only |
| **不用于** | deriveConditionRisk / domain attention scores / npm run evaluate / MedWear-AnalyticsCore-v1 primary benchmark |
| 回退 | `rule-engine-only (default) or feature-heuristic-fallback when enabled but load fails` — 默认关闭。开启后 ONNX 失败时静默跳过，仍用规则引擎 BHI — 不向调用方抛错。 |

实现：`server/config/onnxConfig.js → server/ai/onnxInference.js → server/ai/engine.js`。可选实验性后端 — 默认关闭；不属于 MedWear-AnalyticsCore-v1 主基准；仅开启时做 BHI 分层对比；无疾病筛查或临床性能声明；确定性规则化分析仍为主要研究路径。

## 鲁棒性测试

**BHI 与异常管道返回有限分数/分层且不抛错；输出可优雅降级。**

- 缺失日数据 / 空传感器数组
- 缺失传感器维度（无 HRV、无 SpO₂）
- 单点 HR/SpO₂ 离群值（伪影清洗）
- 传感器漂移（窗口内 HR 渐升）
- 运动伪影（高活动日排除 MAD 基线）
- 恢复/休息日（低步数）

## 探索性队列情景模拟（不在稿件主范围）

**不在稿件主范围。探索性模块 — 合成、参数驱动、非前瞻性验证、未用于主基准、非临床获益证据。**

- 不在稿件主范围
- 合成、参数驱动模拟 — 非前瞻性验证
- 未用于 MedWear-Wearable-Analytics-Benchmark-v3 主基准
- 非临床获益或经验证筛查性能的证据

公开参数：STAGE_DISTRIBUTION、TREATMENT_INITIATION_RATE、CHRONIC_CONTROL_RATE、TIME_TO_TREATMENT、computeRiskScore coefficients。  
情景：conservative、neutral、optimistic（`GET /api/outcomes/scenarios`）。

## 双模式架构

| 模式 | 数据 | 分析 | AI |
|------|------|------|-----|
| 合成评测 | 合成基准队列（seed=42） | BHI + MAD + 规则引擎 | 规则引擎 |
| 真实数据（local-first） | Apple Health 导入 | BHI + MAD + 规则引擎 | 可选 LLM + 同一核心 |

## 一键稿件复现

**主路径：** 合成基准（seed=42）→ BHI → 固定阈值信号标记 → 稳健 MAD 异常 → BHI 关注分层 → engine-versus-reference 评测指标

**可选实验附录：** 可选附录：ONNX BHI 分层对比与透明分量图（非主基准端点）。

Notebook：`notebooks/paper_reproduction.ipynb` · 桥接脚本：`scripts/paper_reproduction_bridge.js`

详见 [EVALUATION.zh.md](./EVALUATION.zh.md)。

**改稿原则：** 运行 `npm run docs:manuscript-sync`，Word/LaTeX **仅**对照 [ARTICLE-FOLLOW-SYSTEM.md](./ARTICLE-FOLLOW-SYSTEM.md) 更新（以系统为准，勿为旧稿反改代码）。
