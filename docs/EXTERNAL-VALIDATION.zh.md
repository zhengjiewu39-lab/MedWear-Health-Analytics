# 公开数据集启发代理健全性检查

MedWear 主基准为**内联合成**数据（`MedWear-Wearable-Analytics-Clinical-v2`，n=5000）+ 独立金标准。为透明起见，项目还提供**可移植 17 维特征导出**（`npm run experiment:export`），与 `experiments/medwear/train.py` 对齐。

> **术语：**  bundled WESAD 相关运行属于 **public-dataset-inspired proxy sanity check** — **不是**外部验证，**不是**在原始 WESAD 受试者数据上的验证。

## 仓库内当前检查

```bash
npm run experiment:export
npm run evaluate:external
```

输出描述性 BHI 分层准确率 — **不能**替代独立临床验证。

## 公开数据集适配器

| 数据集 | 信号重叠 | 状态 |
|--------|----------|------|
| **WESAD 启发代理** | 心率、活动/压力代理 | **已实现 — 仅代理健全性检查** |
| **PPG-DaLiA** | 活动下心率 | 计划中 — PPG/IMU 映射 |
| **MIMIC 可穿戴子集** | SpO₂、HR（ICU） | 远期 — 人群不同 |

### WESAD 启发代理（仅健全性检查）

- **非外部验证：** 使用文献校准的**合成** HR/HRV 窗口 — 非原始 WESAD 生理文件。
- **非疾病标签：** 压力/唤醒代理标签**不代表**临床疾病结局。
- **无标签泄露：** `windowToFeatures()` 仅读生理信号；标签仅用于评估。
- **受试者级 holdout：** 20% 受试者 holdout、每位受试者准确率范围、混淆矩阵。
- **AUC 谨慎解读：** stress-binary AUC 可能因代理映射而偏高（约 0.97–0.99）— **勿放入摘要或主结果**；仅补充材料并附明确说明。

重新生成：`npm run evaluate:external`

详见 [EVALUATION.zh.md](./EVALUATION.zh.md) 补充章节（`npm run evaluate:supplement` 同步）。
