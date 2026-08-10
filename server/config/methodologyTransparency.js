/**
 * Methodology transparency — single source of truth for BHI, MAD anomalies,
 * rule engine, and cohort simulation disclaimers.
 * Docs: run `npm run docs:sync` to regenerate METHODS.md / METHODS.zh.md
 */

const fs = require('fs');
const path = require('path');
const { SCORE_FIELD, WEIGHTS } = require('../services/behavioralHealthIndex');
const { SENSITIVITY_PRESETS } = require('../services/robustAnomaly');
const { BHI_WATCH_TIERS } = require('./bhiWatchTier');
const { EVIDENCE_LEVEL_RULES } = require('../data/researchReferences');

const SOURCE_FILE = 'server/config/methodologyTransparency.js';

const healthScore = {
  kind: SCORE_FIELD.kind,
  apiField: SCORE_FIELD.apiField,
  label_en: SCORE_FIELD.label_en,
  label_zh: SCORE_FIELD.label_zh,
  fieldNote_en: SCORE_FIELD.note_en,
  fieldNote_zh: SCORE_FIELD.note_zh,
  notDiseaseRisk: true,
  implementation: 'server/services/behavioralHealthIndex.js → analyticsCore.computeDayScore()',
  weights: WEIGHTS,
  formulas_en: [
    'Steps (28%): sigmoid — `1 / (1 + exp(-(steps - 5500) / 1800))`',
    'Sleep (24%): Gaussian peak ~7.25 h — `(deep + rem + light + awake) / 60`',
    'RHR (20%): age/sex-adjusted Gaussian — ref ≈ 65 (F) / 62 (M) + 0.15×max(0, age−40)',
    'SpO₂ (16%): logistic — `1 / (1 + exp(-(spo2 - 94) / 0.75))`',
    'HRV (12%): age-adjusted cap — `min(1, hrv / ref)` where ref declines with age',
    'Trend (optional): ±3 pts max vs prior 7-day BHI mean',
    'Missing data: re-normalize over available components; median-imputation sensitivity via `missingDataSensitivity()`',
  ],
  formulas_zh: [
    '步数 (28%)：sigmoid — `1 / (1 + exp(-(steps - 5500) / 1800))`',
    '睡眠 (24%)：高斯峰值 ~7.25 h — `(深睡 + REM + 浅睡 + 清醒) / 60`',
    '静息心率 (20%)：年龄/性别调整高斯 — 参考值 ≈ 女 65 / 男 62 + 0.15×max(0, 年龄−40)',
    'SpO₂ (16%)：logistic — `1 / (1 + exp(-(spo2 - 94) / 0.75))`',
    'HRV (12%)：年龄调整上限 — `min(1, hrv / ref)`',
    '趋势（可选）：相对前 7 日 BHI 均值 ±3 分',
    '缺失数据：对可用分量重新归一化；中位数插补敏感性见 `missingDataSensitivity()`',
  ],
  disclaimer_en: 'BHI is a behavioral wellness index — NOT a calibrated disease-risk score.',
  disclaimer_zh: 'BHI 为行为健康指数 — 非经临床校准的疾病风险评分。',
  limitations_en: [
    'Not calibrated against clinical outcomes',
    'No comorbidity or medication adjustment',
    'Wearable proxy signals only',
  ],
  limitations_zh: [
    '未在临床结局上校准',
    '无合并症/用药调整',
    '仅可穿戴代理信号',
  ],
};

const alerts = {
  label_en: 'Threshold alerts (wearable-style sensitivity)',
  label_zh: '阈值告警（可穿戴式敏感触发）',
  rules_en: [
    'Elevated HR: daily mean OR any peak > heartRateMax (default 100 bpm)',
    'Low HR: daily mean OR any nadir < heartRateMin (default 50 bpm)',
    'Low SpO₂: any reading < spo2Min (default 93%)',
    'Low activity: steps > 0 and steps < 3000',
  ],
  rules_zh: [
    '心率偏高：日均值或任一峰值 > heartRateMax（默认 100 bpm）',
    '心率偏低：日均值或任一谷值 < heartRateMin（默认 50 bpm）',
    '血氧偏低：任一读数 < spo2Min（默认 93%）',
    '活动量不足：步数 > 0 且 < 3000',
  ],
  implementation: 'server/services/analyticsCore.js → evaluateDayAlerts()',
};

const anomalyDetection = {
  method: 'robust-mad-heuristic',
  label_en: 'Robust MAD baseline + activity context filter',
  label_zh: '稳健 MAD 基线 + 活动量上下文过滤',
  notValidatedClinical: true,
  windowDays: 14,
  defaults: { hrMadK: 2.5, spo2MadK: 2.0, activityStepsThreshold: 6500, hrSpikeMinCount: 3, spo2LowMinCount: 2 },
  hrRule_en: 'Baseline HR = median of readings on days with steps < activity threshold; flag when ≥3 readings > median + k·MAD×1.4826',
  hrRule_zh: '基线 HR = 非高活动日（步数 < 阈值）读数的中位数；≥3 次读数 > 中位数 + k·MAD×1.4826 则标记',
  spo2Rule_en: 'Individual SpO₂ baseline median − k·MAD (NOT fixed 93%)',
  spo2Rule_zh: '个体 SpO₂ 基线中位数 − k·MAD（非固定 93%）',
  sensitivityPresets: SENSITIVITY_PRESETS,
  implementation: 'server/services/robustAnomaly.js → analyticsCore.detectAnomaliesFromStore()',
  disclaimer_en: 'Heuristic rule engine — not a validated clinical anomaly detector. No multiple-testing correction.',
  disclaimer_zh: '启发式规则 — 非经临床验证的异常检测器。无多重检验校正。',
  limitations_en: [
    'Exercise/artifact context partially filtered only',
    'Expect false positives under wearable noise',
  ],
  limitations_zh: [
    '运动/伪影上下文仅部分过滤',
    '穿戴噪声下仍可能出现误报',
  ],
};

const bhiWatchTier = {
  label_en: 'BHI watch tiers (behavioral wellness — NOT calibrated disease risk)',
  label_zh: 'BHI 关注分层（行为健康 — 非经临床校准的疾病风险）',
  notCalibratedAgainstOutcomes: true,
  tiers: BHI_WATCH_TIERS,
  implementation: 'server/config/bhiWatchTier.js → classifyBHIWatchTier()',
  disclaimer_en: 'Tier labels (Stable / Observe / Watch closely) are heuristic BHI bands — not validated against clinical outcomes.',
  disclaimer_zh: '分层标签（当前平稳/建议观察/建议重点关注）为 BHI 启发式区间 — 未在临床结局上验证。',
};

const evidenceLevels = {
  label_en: 'Author-assigned evidence tiers (A/B/C)',
  label_zh: '作者标注的证据等级（A/B/C）',
  notExternalRating: true,
  rules: EVIDENCE_LEVEL_RULES,
  disclaimer_en: 'A/B/C levels reflect author annotation from public literature — NOT independent third-party ratings.',
  disclaimer_zh: 'A/B/C 等级为作者基于公开文献的标注 — 非外部机构独立评级。',
  implementation: 'server/data/researchReferences.js → EVIDENCE_LEVEL_RULES + EVIDENCE_RATIONALE',
};

const ruleEngine = {
  engineType: 'evidence-weighted-rule-engine',
  version: 'MedWear-RuleEngine-v1',
  label_en: 'Evidence-weighted rule engine (not ML ensemble)',
  label_zh: '证据加权规则引擎（非 ML 集成）',
  apiFields: {
    referenceDomainLabel: 'Configurable reference domain label — not a trained model name',
    domainWeightedSummaries: 'Domain-weight placeholders — not model votes',
    heuristicConfidence: 'Evidence-adjusted heuristic — not ensemble confidence',
    deprecatedAliases: ['aiModel', 'models', 'modelVotes', 'ensembleConfidence'],
  },
  removedClaims: ['CardioNet-style declared accuracy', 'ensemble confidence clamped to 0.98', 'fake model validation AUC'],
  domainWeights: [
    { domain: 'cardiovascular', weight: 0.28 },
    { domain: 'vitals', weight: 0.22 },
    { domain: 'oncology screening', weight: 0.18 },
    { domain: 'metabolic', weight: 0.16 },
    { domain: 'sleep', weight: 0.16 },
  ],
  fusionWeights: { wearable: 0.55, clinical: 0.30, behavioral: 0.15 },
  confidenceCap: 0.85,
  implementation: 'server/ai/engine.js',
  disclaimer_en: 'Domain weights are configurable placeholders — not trained model votes.',
  disclaimer_zh: '领域权重为可配置占位符 — 非训练模型投票。',
};

const robustnessTests = {
  label_en: 'Robustness scenarios (server/__tests__/robustness.test.js)',
  label_zh: '鲁棒性场景（server/__tests__/robustness.test.js）',
  scenarios_en: [
    'Missing day data / empty sensor arrays',
    'Missing sensor dimensions (no HRV, no SpO₂)',
    'Single-point HR/SpO₂ outliers (artifact cleaning)',
    'Sensor drift (gradual HR elevation over window)',
    'Motion artifact (high-activity days excluded from MAD baseline)',
    'Recovery/rest day (low steps, suppressed activity alerts context)',
  ],
  scenarios_zh: [
    '缺失日数据 / 空传感器数组',
    '缺失传感器维度（无 HRV、无 SpO₂）',
    '单点 HR/SpO₂ 离群值（伪影清洗）',
    '传感器漂移（窗口内 HR 渐升）',
    '运动伪影（高活动日排除 MAD 基线）',
    '恢复/休息日（低步数）',
  ],
  expectation_en: 'BHI and anomaly pipelines return finite scores/tiers without throwing; outputs may degrade gracefully.',
  expectation_zh: 'BHI 与异常管道返回有限分数/分层且不抛错；输出可优雅降级。',
};

const cohortSimulation = {
  kind: 'exploratory-scenario-simulation',
  label_en: 'Exploratory scenario simulation framework (not prospective validation)',
  label_zh: '探索性情景模拟框架（非前瞻性验证）',
  n: 5000,
  notRealWorldValidation: true,
  noPValues: true,
  parameterDriven: true,
  scenarios: ['conservative', 'neutral', 'optimistic'],
  publicParameters: [
    'STAGE_DISTRIBUTION',
    'TREATMENT_INITIATION_RATE',
    'CHRONIC_CONTROL_RATE',
    'TIME_TO_TREATMENT',
    'computeRiskScore coefficients',
  ],
  disclaimer_en: 'Outcomes are highly parameter-driven. For methodology demonstration and sensitivity analysis only — do not report as inferential p-values or proven clinical benefit.',
  disclaimer_zh: '结局高度依赖预设参数。仅用于方法论演示与敏感性分析 — 不可作为推断 p 值或已证实的临床获益。',
  limitations_en: [
    'Intervention advantage partially encoded in preset arm parameters',
    'Not independent validation of system performance',
  ],
  limitations_zh: [
    '干预组优势部分由预设组间参数编码',
    '非系统性能的独立验证',
  ],
};

function getMethodologyTransparency() {
  return {
    version: '1.1.0',
    source: SOURCE_FILE,
    updatedAt: new Date().toISOString(),
    healthScore,
    bhiWatchTier,
    evidenceLevels,
    alerts,
    anomalyDetection,
    ruleEngine,
    robustnessTests,
    cohortSimulation,
    ethicsLink: '/api/methodology/transparency',
  };
}

function renderMethodsMarkdown(isEn = true) {
  const t = getMethodologyTransparency();
  const hs = t.healthScore;
  const an = t.anomalyDetection;
  const al = t.alerts;
  const re = t.ruleEngine;
  const bw = t.bhiWatchTier;
  const ev = t.evidenceLevels;
  const rb = t.robustnessTests;
  const co = t.cohortSimulation;

  if (isEn) {
    return `# MedWear Analytics — Methods

> **Auto-synced (EN/ZH parity)** from \`${SOURCE_FILE}\`. Regenerate: \`npm run docs:sync\` · Verify: \`npm run docs:verify\`.  
> Live API: \`GET /api/methodology/transparency\` · **Engine:** BHI + robust MAD heuristic + \`MedWear-RuleEngine-v1\`

Transparent, reproducible pipeline for real mode and benchmark evaluation. **No black-box DL** for core alerts/anomalies.  
**Not the legacy pipeline:** no discrete 3-tier composite health score; no personal-baseline mean + 2σ anomaly rule.

## Behavioral Health Index (BHI)

**${hs.disclaimer_en}**

| Component | Weight | Function |
|-----------|--------|----------|
${Object.entries(hs.weights).map(([k, v]) => `| ${k} | ${(v * 100).toFixed(0)}% | see formulas below |`).join('\n')}

**Formulas:**

${hs.formulas_en.map((f) => `- ${f}`).join('\n')}

**API field:** \`${hs.apiField}\` = ${hs.label_en}. ${hs.fieldNote_en}

Implementation: \`${hs.implementation}\`

**Limitations:** ${hs.limitations_en.join('; ')}.

## Alerts {#alerts}

${al.label_en}. Implementation: \`${al.implementation}\`

${al.rules_en.map((r) => `- ${r}`).join('\n')}

## Anomaly Detection {#anomalies}

**${an.disclaimer_en}**

- Window: ${an.windowDays} days
- ${an.hrRule_en}
- ${an.spo2Rule_en}
- Defaults: hrMadK=${an.defaults.hrMadK}, spo2MadK=${an.defaults.spo2MadK}, activity filter ≥${an.defaults.activityStepsThreshold} steps

### Sensitivity presets

| Preset | windowDays | hrMadK | spo2MadK | activityStepsThreshold |
|--------|------------|--------|----------|------------------------|
${Object.entries(an.sensitivityPresets).map(([name, p]) => `| ${name} | ${p.windowDays} | ${p.hrMadK} | ${p.spo2MadK} | ${p.activityStepsThreshold} |`).join('\n')}

Implementation: \`${an.implementation}\`

## BHI Watch Tiers (not disease risk)

**${bw.disclaimer_en}**

| Internal key | UI label (EN) | BHI range |
|--------------|---------------|-----------|
| low | ${BHI_WATCH_TIERS.low.label_en} | ≥ 80 |
| moderate | ${BHI_WATCH_TIERS.moderate.label_en} | 60–79 |
| high | ${BHI_WATCH_TIERS.high.label_en} | < 60 |

Implementation: \`${bw.implementation}\`

## Evidence Levels (A/B/C)

**${ev.disclaimer_en}**

| Level | Criteria |
|-------|----------|
| A | ${EVIDENCE_LEVEL_RULES.A.criteria_en} |
| B | ${EVIDENCE_LEVEL_RULES.B.criteria_en} |
| C | ${EVIDENCE_LEVEL_RULES.C.criteria_en} |

Implementation: \`${ev.implementation}\`

## Rule Engine (Screening)

**${re.disclaimer_en}** \`engineType: ${re.engineType}\` · Version: \`${re.version}\`. Confidence capped at ${re.confidenceCap}.

| Domain | Weight |
|--------|--------|
${re.domainWeights.map((d) => `| ${d.domain} | ${(d.weight * 100).toFixed(0)}% |`).join('\n')}

Honest API fields: \`referenceDomainLabel\`, \`domainWeightedSummaries\`, \`heuristicConfidence\`. Deprecated aliases (not shown in UI): ${re.apiFields.deprecatedAliases.join(', ')}.

Removed claims: ${re.removedClaims.join('; ')}.

## Robustness Testing

**${rb.expectation_en}**

${rb.scenarios_en.map((s) => `- ${s}`).join('\n')}

## Exploratory Cohort Scenario Simulation

**${co.disclaimer_en}**

Public parameters: ${co.publicParameters.join(', ')}.  
Scenarios: ${co.scenarios.join(', ')} (via \`GET /api/outcomes/scenarios\`).

## Dual-Mode Architecture

| Mode | Data | Analytics | AI |
|------|------|-----------|-----|
| Demo | Synthetic mock | BHI + MAD + rule engine | Rule engine |
| Real | Apple Health import | BHI + MAD + rule engine | Optional LLM + same core |

See [EVALUATION.md](./EVALUATION.md) for benchmark protocol.
`;
  }

  return `# MedWear 分析引擎 — 方法学

> **自动同步（中英文一致）**自 \`${SOURCE_FILE}\`。重新生成：\`npm run docs:sync\` · 校验：\`npm run docs:verify\`。  
> 在线 API：\`GET /api/methodology/transparency\` · **引擎：** BHI + 稳健 MAD 启发式 + \`MedWear-RuleEngine-v1\`

真实模式与基准评测使用的**透明、可复现**流水线。核心告警/异常**不使用黑盒深度学习**。  
**非旧版流水线：** 无离散三档综合健康分；无个人基线 mean + 2σ 异常规则。

## 行为健康指数（BHI）

**${hs.disclaimer_zh}**

| 组成 | 权重 | 函数 |
|------|------|------|
${Object.entries(hs.weights).map(([k, v]) => `| ${k} | ${(v * 100).toFixed(0)}% | 见下式 |`).join('\n')}

公式：

${hs.formulas_zh.map((f) => `- ${f}`).join('\n')}

**API 字段：** \`${hs.apiField}\` = ${hs.label_zh}。${hs.fieldNote_zh}

实现：\`${hs.implementation}\`

**局限：** ${hs.limitations_zh.join('；')}。

## 告警 {#alerts}

${al.label_zh}。实现：\`${al.implementation}\`

${al.rules_zh.map((r) => `- ${r}`).join('\n')}

## 异常检测 {#anomalies}

**${an.disclaimer_zh}**

- 窗口：${an.windowDays} 天
- ${an.hrRule_zh}
- ${an.spo2Rule_zh}
- 默认：hrMadK=${an.defaults.hrMadK}，spo2MadK=${an.defaults.spo2MadK}，高活动过滤 ≥${an.defaults.activityStepsThreshold} 步

### 敏感性预设

| 预设 | windowDays | hrMadK | spo2MadK | activityStepsThreshold |
|------|------------|--------|----------|------------------------|
${Object.entries(an.sensitivityPresets).map(([name, p]) => `| ${name} | ${p.windowDays} | ${p.hrMadK} | ${p.spo2MadK} | ${p.activityStepsThreshold} |`).join('\n')}

实现：\`${an.implementation}\`

## BHI 关注分层（非疾病风险）

**${bw.disclaimer_zh}**

| 内部键 | UI 标签（中文） | BHI 区间 |
|--------|-----------------|----------|
| low | ${BHI_WATCH_TIERS.low.label_zh} | ≥ 80 |
| moderate | ${BHI_WATCH_TIERS.moderate.label_zh} | 60–79 |
| high | ${BHI_WATCH_TIERS.high.label_zh} | < 60 |

实现：\`${bw.implementation}\`

## 证据等级（A/B/C）

**${ev.disclaimer_zh}**

| 等级 | 判定规则 |
|------|----------|
| A | ${EVIDENCE_LEVEL_RULES.A.criteria_zh} |
| B | ${EVIDENCE_LEVEL_RULES.B.criteria_zh} |
| C | ${EVIDENCE_LEVEL_RULES.C.criteria_zh} |

实现：\`${ev.implementation}\`

## 规则引擎（筛查）

**${re.disclaimer_zh}** \`engineType: ${re.engineType}\` · 版本：\`${re.version}\`。置信度上限 ${re.confidenceCap}。

| 领域 | 权重 |
|------|------|
${re.domainWeights.map((d) => `| ${d.domain} | ${(d.weight * 100).toFixed(0)}% |`).join('\n')}

诚实 API 字段：\`referenceDomainLabel\`、\`domainWeightedSummaries\`、\`heuristicConfidence\`。已弃用别名（前端不展示）：${re.apiFields.deprecatedAliases.join('、')}。

已移除声明：${re.removedClaims.join('；')}。

## 鲁棒性测试

**${rb.expectation_zh}**

${rb.scenarios_zh.map((s) => `- ${s}`).join('\n')}

## 探索性队列情景模拟

**${co.disclaimer_zh}**

公开参数：${co.publicParameters.join('、')}。  
情景：${co.scenarios.join('、')}（\`GET /api/outcomes/scenarios\`）。

## 双模式架构

| 模式 | 数据 | 分析 | AI |
|------|------|------|-----|
| 演示 | 合成模拟 | BHI + MAD + 规则引擎 | 规则引擎 |
| 真实 | Apple Health | BHI + MAD + 规则引擎 | 可选 LLM + 同一核心 |

详见 [EVALUATION.zh.md](./EVALUATION.zh.md)。
`;
}

function syncMethodsDocs(rootDir = path.join(__dirname, '../..')) {
  const en = renderMethodsMarkdown(true);
  const zh = renderMethodsMarkdown(false);
  fs.writeFileSync(path.join(rootDir, 'docs/METHODS.md'), en);
  fs.writeFileSync(path.join(rootDir, 'docs/METHODS.zh.md'), zh);
  return { en: 'docs/METHODS.md', zh: 'docs/METHODS.zh.md' };
}

module.exports = {
  getMethodologyTransparency,
  renderMethodsMarkdown,
  syncMethodsDocs,
  healthScore,
  alerts,
  anomalyDetection,
  bhiWatchTier,
  evidenceLevels,
  robustnessTests,
  ruleEngine,
  cohortSimulation,
};
