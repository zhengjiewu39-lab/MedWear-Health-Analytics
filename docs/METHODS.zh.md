# MedWear 分析引擎 — 方法学

> **自动同步**自 `server/config/methodologyTransparency.js`。重新生成：`npm run docs:sync`。  
> 在线 API：`GET /api/methodology/transparency`

真实模式与基准评测使用的**透明、可复现**流水线。核心告警/异常**不使用黑盒深度学习**。

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

## 风险分层（基于 BHI）

| 等级 | BHI 分数 |
|------|----------|
| 低 | ≥ 80 |
| 中 | 60–79 |
| 高 | < 60 |

## 规则引擎（筛查）

**领域权重为可配置占位符 — 非训练模型投票。** 版本：`MedWear-RuleEngine-v1`。置信度上限 0.85。

| 领域 | 权重 |
|------|------|
| cardiovascular | 28% |
| vitals | 22% |
| oncology screening | 18% |
| metabolic | 16% |
| sleep | 16% |

已移除声明：CardioNet-style declared accuracy；ensemble confidence clamped to 0.98；fake model validation AUC。

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
