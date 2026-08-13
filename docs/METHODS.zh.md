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

- 步数 (28%)：sigmoid — `1 / (1 + exp(-(steps - 5500) / 1800))`
- 睡眠 (24%)：高斯峰值 ~7.25 h — `(深睡 + REM + 浅睡 + 清醒) / 60`
- 静息心率 (20%)：年龄/性别调整高斯 — 参考值 ≈ 女 65 / 男 62 + 0.15×max(0, 年龄−40)
- SpO₂ (16%)：logistic — `1 / (1 + exp(-(spo2 - 94) / 0.75))`
- HRV (12%)：年龄调整上限 — `min(1, hrv / ref)`
- 趋势（可选）：相对前 7 日 BHI 均值 ±3 分
- 缺失数据：对可用分量重新归一化；中位数插补敏感性见 `missingDataSensitivity()`

**API 字段：** `healthScore` = 行为健康指数（BHI）。字段名 healthScore 为向后兼容保留；数值为 BHI（行为健康指数），非经临床校准的疾病风险评分。

实现：`server/services/behavioralHealthIndex.js → analyticsCore.computeDayScore()`

**局限：** 未在临床结局上校准；无合并症/用药调整；仅可穿戴代理信号。

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

## 规则引擎（筛查）

**领域权重为可配置占位符 — 非训练模型投票。** `engineType: evidence-weighted-rule-engine` · 版本：`MedWear-RuleEngine-v1`。置信度上限 0.85。

| 领域 | 权重 |
|------|------|
| cardiovascular | 28% |
| vitals | 22% |
| oncology screening | 18% |
| metabolic | 16% |
| sleep | 16% |

诚实 API 字段：`referenceDomainLabel`、`domainWeightedSummaries`、`heuristicConfidence`。已弃用别名（前端不展示）：aiModel、models、modelVotes、ensembleConfidence。

已移除声明：CardioNet-style declared accuracy；ensemble confidence clamped to 0.98；fake model validation AUC。

## 可选 ONNX 推理后端

**证据加权规则引擎（BHI + MAD + 筛查规则）为默认产品核心 — 除非显式开启，否则 ONNX 默认关闭。**

| 项 | 说明 |
|----|------|
| 开启开关 | `MEDWEAR_ENABLE_ONNX=false (default — opt-in only)` |
| 模型文件 | `server/ai/models/medwear_rf.onnx + medwear_rf.meta.json` |
| 训练脚本 | `experiments/medwear/train.py (sklearn RandomForest → skl2onnx export)` |
| 训练数据 | MedWear-Wearable-Analytics-Clinical-v2 合成导出（n=5000, seed=42）→ scripts/export_features.js 生成 experiments/data/medwear/features_v1.csv |
| 标签目标 | BHI 关注分层（low/moderate/high）— 仅实验性对比展示；不参与疾病筛查分数 |
| 运行时 | onnxruntime-node via server/ai/onnxInference.js |
| 用于 | runFullAnalysis() when MEDWEAR_ENABLE_ONNX=true — experimentalBhiTierComparison field only |
| **不用于** | deriveConditionRisk / disease screening scores / npm run evaluate / MedWear-AnalyticsCore-v1 benchmark |
| 回退 | `rule-engine-only (default) or feature-heuristic-fallback when enabled but load fails` — 默认关闭。开启后 ONNX 失败时静默跳过，仍用规则引擎 BHI — 不向调用方抛错。 |

实现：`server/config/onnxConfig.js → server/ai/onnxInference.js → server/ai/engine.js`。需显式开启的实验性后端 — 仅 BHI 分层对比；未经临床验证；筛查信号仍由规则引擎生成。

## 鲁棒性测试

**BHI 与异常管道返回有限分数/分层且不抛错；输出可优雅降级。**

- 缺失日数据 / 空传感器数组
- 缺失传感器维度（无 HRV、无 SpO₂）
- 单点 HR/SpO₂ 离群值（伪影清洗）
- 传感器漂移（窗口内 HR 渐升）
- 运动伪影（高活动日排除 MAD 基线）
- 恢复/休息日（低步数）

## 探索性队列情景模拟

**结局高度依赖预设参数。仅用于方法论演示与敏感性分析 — 不可作为推断 p 值或已证实的临床获益。**

公开参数：STAGE_DISTRIBUTION、TREATMENT_INITIATION_RATE、CHRONIC_CONTROL_RATE、TIME_TO_TREATMENT、computeRiskScore coefficients。  
情景：conservative、neutral、optimistic（`GET /api/outcomes/scenarios`）。

## 双模式架构

| 模式 | 数据 | 分析 | AI |
|------|------|------|-----|
| 演示 | 合成模拟 | BHI + MAD + 规则引擎 | 规则引擎 |
| 真实 | Apple Health | BHI + MAD + 规则引擎 | 可选 LLM + 同一核心 |

详见 [EVALUATION.zh.md](./EVALUATION.zh.md)。
