# 外部数据集描述性检查与验证计划

MedWear 主基准为**内联合成**数据（`MedWear-Wearable-Analytics-Clinical-v2`，n=5000）+ 独立金标准。为提升可泛化性论述，项目提供**可移植 17 维特征导出**（`npm run experiment:export`），与 `experiments/medwear/train.py` 使用同一 schema。

## 当前基线（仓库内）

```bash
npm run experiment:export
npm run evaluate:external
```

输出描述性标签分布与启发式 BHI 分层准确率 — **不能**替代完整外部验证。

## 公开数据集适配器

| 数据集 | 信号重叠 | 状态 |
|--------|----------|------|
| **WESAD** | 心率、活动/压力代理 | **已实现 — 仅描述性健全性检查** |
| **PPG-DaLiA** | 活动下心率 | 计划中 — PPG/IMU 映射 |
| **MIMIC 可穿戴子集** | SpO₂、HR（ICU） | 远期 — 人群不同 |

### WESAD（已实现 — 仅健全性检查）

- **非疾病标签：** WESAD 压力/唤醒标签映射为二分类压力代理 — **不代表**临床疾病结局。
- **代理信号：**  bundled 适配器使用文献校准的合成 HR/HRV 窗口（`server/adapters/publicDatasetAdapter.js`），非原始 WESAD 受试者文件。
- **无标签泄露：** 特征构建（`windowToFeatures`）仅读取生理信号 — 标签与特征分离。
- **受试者级 holdout：** 指标含 20% 受试者 holdout、每位受试者准确率范围、混淆矩阵及 stress-binary AUC 的 bootstrap 95% CI。
- **不能替代验证：** 结果仅说明信号处理合理性 — 高可区分性可能来自代理映射，非泛化性能。

重新生成：`npm run evaluate:external`

适配器应对齐 `server/services/extractFeatures.js` 列名，以便复用规则引擎与 sklearn 基线。

详见 [EVALUATION.zh.md](./EVALUATION.zh.md) 补充章节（`npm run evaluate:supplement` 同步）。
