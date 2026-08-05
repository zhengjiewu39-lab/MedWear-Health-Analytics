# 评测协议

## 基准数据集

**MedWear-Wearable-Analytics-Clinical-v2** — 1000 例合成多日可穿戴案例（CC-BY-4.0），可用于 Wilson 95% CI 临床性能估计。

### 双引擎架构（防止自评虚高）

| 角色 | 模块 | 用途 |
|------|------|------|
| 产品流水线 | `MedWear-AnalyticsCore-v1` | 应用内实时告警/异常/风险 |
| 基准金标准 | `clinicalGoldStandard-v1` | 独立标注（更严 SpO₂、不同评分公式） |
| 评测 | `engine-vs-gold-agreement` | 衡量分歧率，**非**引擎自标注 |

生理信号：**28% 均匀随机** + **72% 表型随机**（`seed=42`）。

每例含 7 天步数、心率、SpO₂、HRV、睡眠；**临床金标准** 由 `clinicalGoldStandard-v1` 裁决（与产品引擎分离）：

- 预期告警类型
- 是否存在异常（二分类）
- 风险等级（低 / 中 / 高）
- 健康评分下限

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
| 告警 F1 | 告警类型集合上的 micro-F1（每例精确匹配亦报告） |
| 异常准确率 | `anomalyDetected` 二分类一致率 |
| 风险准确率 | `riskLevel` 三分类一致率 |
| 分数达标 | healthScore ≥ 预期下限 |
| 95% CI | Wilson 区间（n≥100 时可用于临床报告） |

## 参考结果（v2，n=1000）

运行 `npm run evaluate` 获取当前数值及置信区间。指标为 **产品引擎 vs 临床金标准** 的一致率；若全部 ≥98% 说明标注与引擎同源（无效）。典型量级：告警 F1 ~0.90，异常/风险 ~85%，评分一致 ~94%。

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

## 筛查-结局队列（筛查组 vs 对照组）

模拟基准，对应论文问题：*可穿戴驱动的早筛与干预是否较无早筛对照组改善慢病/肿瘤的分期、治疗启动与存活？*

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

> 所有结局均由已发表参数模拟，非前瞻性观察结果。仪表盘：`/outcomes`（需登录）。

## 临床队列外部验证（SEER / NLST / 中国 NCCR）

对照已发表登记与试验子集的外部验证（非完整患者级数据 dump）。

**模块：** `server/screening/cohortValidator.js`  
**参考文献：** `server/screening/clinicalReferenceData.js`

```bash
npm run validate:cohort   # → benchmarks/results/clinical-validation-latest.json
```

### 验证结局

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
