# 评测协议

## 基准数据集

**MedWear-Wearable-Analytics-Mini-v1** — 8 例合成多日可穿戴案例（CC-BY-4.0）。

每例含 7 天步数、心率、SpO₂、HRV、睡眠及专家标注：

- 预期告警类型
- 是否存在异常（二分类）
- 风险等级（低 / 中 / 高）
- 健康评分下限

文件：`benchmarks/wearable-analytics-dataset.json`

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

## 参考结果（v1，n=8）

运行 `npm run evaluate` 获取当前数值。规则流水线与标注阈值一致，预期表现稳定。

## API 评测

```bash
curl -X POST http://localhost:3001/api/research/evaluate
curl http://localhost:3001/api/research/results
```

## 后续工作

- 扩展至 50+ 案例（缺失传感器、稀疏数据等边界）
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
