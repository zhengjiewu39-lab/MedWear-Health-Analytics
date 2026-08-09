# 外部数据集验证计划

MedWear 主基准为**内联合成**数据（`MedWear-Wearable-Analytics-Clinical-v2`，n=5000）+ 独立金标准。为提升可泛化性论述，项目提供**可移植 17 维特征导出**（`npm run experiment:export`），与 `experiments/medwear/train.py` 使用同一 schema。

## 当前基线（仓库内）

```bash
npm run experiment:export
npm run evaluate:external
```

输出描述性标签分布与启发式 BHI 分层准确率 — **不能**替代完整外部验证。

## 计划中的公开数据集适配

| 数据集 | 信号重叠 | 状态 |
|--------|----------|------|
| **WESAD** | 心率、活动/压力代理 | 计划中 — 需下载与合规子集 |
| **PPG-DaLiA** | 活动下心率 | 计划中 — PPG/IMU 映射 |
| **MIMIC 可穿戴子集** | SpO₂、HR（ICU） | 远期 — 人群不同 |

适配器应对齐 `server/services/extractFeatures.js` 列名，以便复用规则引擎与 sklearn 基线。

详见 [EVALUATION.zh.md](./EVALUATION.zh.md) 补充章节（`npm run evaluate:supplement` 同步）。
