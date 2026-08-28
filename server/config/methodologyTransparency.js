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
    'Steps (28%): sigmoid — `1 / (1 + exp(-(steps - 5500) / 1800))` (component used only when `steps > 0`; see step-zero limitation)',
    'Sleep (24%): Gaussian peak ~7.25 h — estimated sleep duration `(deep + rem + light) / 60` hours; **awake is excluded** from sleep duration',
    'Sleep score: `exp(-((hours - 7.25)^2) / (2 * 1.4^2))`',
    'RHR (20%): age/sex-adjusted Gaussian — ref = (male ? 62 : 65) + 0.15 × max(0, age−40); score `exp(-((rhr - ref)^2) / (2 * 12^2))`',
    'SpO₂ (16%): logistic — `1 / (1 + exp(-(spo2 - 94) / 0.75))`',
    'HRV-SDNN (12%): Apple Health `HeartRateVariabilitySDNN` (SDNN in ms, **not RMSSD**)',
    'SDNN reference: `ref_sdnn(age) = max(28, 50 - 0.45 * max(0, age - 30))`',
    'SDNN score: `min(1, sdnn / ref_sdnn(age))`',
    'Trend (conditional): when `priorDays` supplied and ≥3 valid prior BHI scores exist, `computeDayScore()` applies `computeBHIWithTrend()` (multiplier 0.12; adjustment clamped ±3; final BHI [0,100]). Primary benchmark supplies prior days — evaluates trend-adjusted pathway.',
    'Missing data: re-normalize over available components; median-imputation sensitivity via `missingDataSensitivity()`',
  ],
  formulas_zh: [
    '步数 (28%)：sigmoid — `1 / (1 + exp(-(steps - 5500) / 1800))`（仅当 `steps > 0` 时使用；见步数为零说明）',
    '睡眠 (24%)：高斯峰值 ~7.25 h — 估计睡眠时长 `(深睡 + REM + 浅睡) / 60` 小时；**清醒阶段不计入睡眠时长**',
    '睡眠得分：`exp(-((hours - 7.25)^2) / (2 * 1.4^2))`',
    '静息心率 (20%)：年龄/性别调整高斯 — 参考值 = (男 ? 62 : 65) + 0.15 × max(0, 年龄−40)；得分 `exp(-((rhr - ref)^2) / (2 * 12^2))`',
    'SpO₂ (16%)：logistic — `1 / (1 + exp(-(spo2 - 94) / 0.75))`',
    'HRV-SDNN (12%)：Apple Health `HeartRateVariabilitySDNN`（SDNN，单位 ms，**非 RMSSD**）',
    'SDNN 参考：`ref_sdnn(age) = max(28, 50 - 0.45 * max(0, age - 30))`',
    'SDNN 得分：`min(1, sdnn / ref_sdnn(age))`',
    '趋势（条件性）：当提供 `priorDays` 且 ≥3 个有效 prior BHI 时，`computeDayScore()` 调用 `computeBHIWithTrend()`（系数 0.12；调整限 ±3；最终 BHI [0,100]）。主基准提供 prior days — 评测含趋势调整路径。',
    '缺失数据：对可用分量重新归一化；中位数插补敏感性见 `missingDataSensitivity()`',
  ],
  demographicsFallback_en:
    'When age or biological-sex metadata are unavailable, the compatibility path uses age 45 and female as fallback values and marks the demographic configuration as inferred (`fallbackUsed: true`). These fallback values are software compatibility defaults and are not population reference standards.',
  demographicsFallback_zh:
    '当年龄或生理性别元数据不可获得时，兼容路径使用年龄45岁和女性作为后备参数，并将人口学配置标记为推断值（`fallbackUsed: true`）。该后备参数仅用于软件兼容，不代表人群正常参考标准。',
  stepZeroLimitation_en: [
    'Zero step count is currently treated as unavailable for BHI component scoring (`steps > 0` required).',
    'The implementation cannot distinguish a true zero-step day from an absent daily step record in this path.',
    'The steps component is omitted and remaining BHI weights are renormalized.',
  ],
  stepZeroLimitation_zh: [
    '当前实现中，步数为零视为 BHI 步数分量不可用（需 `steps > 0`）。',
    '此路径无法区分真实零步数日与缺失的日步数记录。',
    '步数分量被省略，其余 BHI 权重重新归一化。',
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

const primaryBenchmark = {
  dataset: 'MedWear-Wearable-Analytics-Benchmark-v3',
  n: 5000,
  seed: 42,
  productEngine: 'MedWear-AnalyticsCore-v1',
  referenceEngine: 'independentSyntheticReference-v1',
  evaluationModel: 'engine-versus-reference-agreement',
  evaluates_en: [
    'Fixed threshold alert outputs',
    'MAD robust anomaly outputs',
    'BHI score (trend-adjusted when prior days supplied)',
    'BHI watch tier',
  ],
  evaluates_zh: [
    '固定阈值告警输出',
    'MAD 稳健异常输出',
    'BHI 评分（提供 prior days 时含趋势调整）',
    'BHI 关注分层',
  ],
  doesNotEvaluate_en: [
    'Domain-weighted RuleEngine research-signal integration outputs',
    'Exploratory cohort/scenario simulation modules',
    'Optional ONNX experimental backend',
  ],
  doesNotEvaluate_zh: [
    '领域加权 RuleEngine 研究信号整合输出',
    '探索性队列/情景模拟模块',
    '可选 ONNX 实验后端',
  ],
  referenceLabels_en:
    'Independent synthetic reference labels are rule-generated synthetic reference labels and do not constitute clinical ground truth.',
  referenceLabels_zh:
    '独立合成参考标签为规则生成的合成参考标签，不构成临床 ground truth。',
  scoreTolerance_en:
    'The ±8 BHI score-agreement criterion is a prespecified heuristic benchmark tolerance, not a clinically validated equivalence margin.',
  scoreTolerance_zh:
    '±8 分 BHI 一致标准为预设的启发式基准容差，非经临床验证的等效界值。',
};

const ruleEngine = {
  engineType: 'evidence-weighted-rule-engine',
  version: 'MedWear-RuleEngine-v1',
  sectionTitle_en: 'Rule Engine (Research Signal Integration — exploratory)',
  sectionTitle_zh: '规则引擎（研究信号整合 — 探索性）',
  label_en: 'Evidence-weighted rule engine (research signal integration — not ML ensemble)',
  label_zh: '证据加权规则引擎（研究信号整合 — 非 ML 集成）',
  outsidePrimaryManuscriptScope_en: [
    'Not evaluated in MedWear-Wearable-Analytics-Benchmark-v3 primary benchmark',
    'Not part of the manuscript principal claims',
    'Not clinical validation or validated screening performance',
    'Not evidence of patient benefit',
  ],
  outsidePrimaryManuscriptScope_zh: [
    '不在 MedWear-Wearable-Analytics-Benchmark-v3 主基准评测范围内',
    '不属于稿件主要结论',
    '非临床验证或经验证的筛查性能',
    '非患者获益证据',
  ],
  apiFields: {
    overallBhiTier: 'BHI watch tier from rule engine — not disease risk',
    attentionScore: 'Rule-derived attention signal score — not disease probability',
    evidenceAdjustedAttentionScore: 'Evidence-tier adjusted attention score — not calibrated disease risk',
    signalLevel: 'Low/moderate/high attention tier for UI',
    heuristicSupport: 'Evidence-display support weight — not statistical confidence',
    referenceDomainLabel: 'Configurable reference domain label — not a trained model name',
    domainWeightedSummaries: 'Domain-weight placeholders — not model votes',
    deprecatedAliases: [
      'overallRisk', 'risk', 'rawRisk', 'calibratedRisk', 'level',
      'heuristicConfidence', 'confidence', 'aiModel', 'models', 'modelVotes', 'ensembleConfidence',
    ],
  },
  removedClaims: ['CardioNet-style declared accuracy', 'ensemble confidence clamped to 0.98', 'fake model validation AUC'],
  domainWeights: [
    { domain: 'cardiovascular', weight: 0.28 },
    { domain: 'vitals', weight: 0.22 },
    { domain: 'oncology-related reference domain', weight: 0.18 },
    { domain: 'metabolic', weight: 0.16 },
    { domain: 'sleep', weight: 0.16 },
  ],
  fusionWeights: { wearable: 0.55, clinical: 0.30, behavioral: 0.15 },
  fusionWeightsDisclaimer_en:
    'Configurable presentation weights selected for prototype demonstration — not learned coefficients and not externally validated.',
  fusionWeightsDisclaimer_zh:
    '原型演示用可配置展示权重 — 非学习系数，未经外部验证。',
  confidenceCap: 0.85,
  implementation: 'server/ai/engine.js',
  disclaimer_en: 'Domain weights are configurable placeholders — not trained model votes.',
  disclaimer_zh: '领域权重为可配置占位符 — 非训练模型投票。',
};

const optionalOnnxBackend = {
  label_en: 'Optional ONNX inference backend',
  label_zh: '可选 ONNX 推理后端',
  isDefaultCore: false,
  enableFlag: 'MEDWEAR_ENABLE_ONNX=false (default — opt-in only)',
  defaultCore_en: 'The deterministic rule-based analytics (BHI + MAD + research signal rules) are the primary research pathway — ONNX is disabled by default unless explicitly enabled.',
  defaultCore_zh: '确定性规则化分析（BHI + MAD + 研究信号规则）为主要研究路径 — 除非显式开启，否则 ONNX 默认关闭。',
  modelArtifact: 'server/ai/models/medwear_rf.onnx + medwear_rf.meta.json',
  trainingScript: 'experiments/medwear/train.py (sklearn RandomForest → skl2onnx export)',
  trainingData_en: 'MedWear-Wearable-Analytics-Benchmark-v3 synthetic export (n=5000, seed=42) → experiments/data/medwear/features_v1.csv via scripts/export_features.js',
  trainingData_zh: 'MedWear-Wearable-Analytics-Benchmark-v3 合成导出（n=5000, seed=42）→ scripts/export_features.js 生成 experiments/data/medwear/features_v1.csv',
  labelTarget_en: 'BHI watch tier (low/moderate/high) — experimental comparison display only when ONNX enabled; never feeds domain attention scores',
  labelTarget_zh: 'BHI 关注分层（low/moderate/high）— 仅 ONNX 开启时的实验性对比展示；不参与领域关注分数',
  runtime: 'onnxruntime-node via server/ai/onnxInference.js',
  usedIn: 'runFullAnalysis() when MEDWEAR_ENABLE_ONNX=true — experimentalBhiTierComparison field only',
  notUsedIn: 'deriveConditionRisk / domain attention scores / npm run evaluate / MedWear-AnalyticsCore-v1 primary benchmark',
  fallback: 'rule-engine-only (default) or feature-heuristic-fallback when enabled but load fails',
  fallbackBehavior_en: 'Default off. When enabled, ONNX failures silently skip to rule-engine BHI — no thrown errors.',
  fallbackBehavior_zh: '默认关闭。开启后 ONNX 失败时静默跳过，仍用规则引擎 BHI — 不向调用方抛错。',
  implementation: 'server/config/onnxConfig.js → server/ai/onnxInference.js → server/ai/engine.js',
  disclaimer_en: 'Optional experimental backend — disabled by default; not part of MedWear-AnalyticsCore-v1 primary benchmark; BHI-tier comparison only when enabled; no disease-screening or clinical-performance claims; deterministic rule-based analytics remain the primary research pathway.',
  disclaimer_zh: '可选实验性后端 — 默认关闭；不属于 MedWear-AnalyticsCore-v1 主基准；仅开启时做 BHI 分层对比；无疾病筛查或临床性能声明；确定性规则化分析仍为主要研究路径。',
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
  disclaimer_en: 'Exploratory modules outside primary manuscript scope. Outcomes are highly parameter-driven. For methodology demonstration and sensitivity analysis only — do not report as inferential p-values or proven clinical benefit.',
  disclaimer_zh: '探索性模块，不在稿件主范围。结局高度依赖预设参数。仅用于方法论演示与敏感性分析 — 不可作为推断 p 值或已证实的临床获益。',
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
    primaryBenchmark,
    healthScore,
    bhiWatchTier,
    evidenceLevels,
    alerts,
    anomalyDetection,
    ruleEngine,
    optionalOnnxBackend,
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
  const onnx = t.optionalOnnxBackend;
  const bw = t.bhiWatchTier;
  const ev = t.evidenceLevels;
  const rb = t.robustnessTests;
  const pb = t.primaryBenchmark;
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

**Demographics fallback:** ${hs.demographicsFallback_en}

**Step-zero limitation:** ${hs.stepZeroLimitation_en.join(' ')}

**Limitations:** ${hs.limitations_en.join('; ')}.

## Primary benchmark scope (MedWear-Wearable-Analytics-Benchmark-v3)

Dataset: \`${pb.dataset}\` · n=${pb.n} · seed=${pb.seed} · Product engine: \`${pb.productEngine}\` · Reference: \`${pb.referenceEngine}\` · Evaluation: ${pb.evaluationModel}.

**Evaluates:** ${pb.evaluates_en.join('; ')}.

**Does not evaluate:** ${pb.doesNotEvaluate_en.join('; ')}.

${pb.referenceLabels_en}

${pb.scoreTolerance_en}

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

## ${re.sectionTitle_en}

**Exploratory — outside primary manuscript scope.** ${re.outsidePrimaryManuscriptScope_en.join(' ')}

**${re.disclaimer_en}** \`engineType: ${re.engineType}\` · Version: \`${re.version}\`. Confidence capped at ${re.confidenceCap}.

| Domain | Weight |
|--------|--------|
${re.domainWeights.map((d) => `| ${d.domain} | ${(d.weight * 100).toFixed(0)}% |`).join('\n')}

Honest API fields: \`overallBhiTier\`, \`attentionScore\`, \`evidenceAdjustedAttentionScore\`, \`signalLevel\`, \`heuristicSupport\`, \`referenceDomainLabel\`, \`domainWeightedSummaries\`. Deprecated aliases (not shown in UI): ${re.apiFields.deprecatedAliases.join(', ')}.

Fusion presentation weights (wearable ${re.fusionWeights.wearable} / clinical ${re.fusionWeights.clinical} / behavioral ${re.fusionWeights.behavioral}): ${re.fusionWeightsDisclaimer_en}

Removed claims: ${re.removedClaims.join('; ')}.

## Optional ONNX inference backend

**${onnx.defaultCore_en}**

| Item | Detail |
|------|--------|
| Enable flag | \`${onnx.enableFlag}\` |
| Artifact | \`${onnx.modelArtifact}\` |
| Training | \`${onnx.trainingScript}\` |
| Training data | ${onnx.trainingData_en} |
| Label target | ${onnx.labelTarget_en} |
| Runtime | ${onnx.runtime} |
| Used in | ${onnx.usedIn} |
| **Not used in** | ${onnx.notUsedIn} |
| Fallback | \`${onnx.fallback}\` — ${onnx.fallbackBehavior_en} |

Implementation: \`${onnx.implementation}\`. ${onnx.disclaimer_en}

## Robustness Testing

**${rb.expectation_en}**

${rb.scenarios_en.map((s) => `- ${s}`).join('\n')}

## Exploratory cohort scenario simulation (outside primary manuscript scope)

**${co.disclaimer_en}**

Public parameters: ${co.publicParameters.join(', ')}.  
Scenarios: ${co.scenarios.join(', ')} (via \`GET /api/outcomes/scenarios\`).

## Dual-mode architecture

| Mode | Data | Analytics | AI |
|------|------|-----------|-----|
| Synthetic evaluation | Synthetic benchmark cohort (seed=42) | BHI + MAD + rule engine | Rule engine |
| Real-data (local-first) | Apple Health import | BHI + MAD + rule engine | Optional LLM + same core |

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

**人口学后备参数：** ${hs.demographicsFallback_zh}

**步数为零说明：** ${hs.stepZeroLimitation_zh.join(' ')}

**局限：** ${hs.limitations_zh.join('；')}。

## 主基准范围（MedWear-Wearable-Analytics-Benchmark-v3）

数据集：\`${pb.dataset}\` · n=${pb.n} · seed=${pb.seed} · 产品引擎：\`${pb.productEngine}\` · 参考：\`${pb.referenceEngine}\` · 评测：${pb.evaluationModel}。

**评测内容：** ${pb.evaluates_zh.join('；')}。

**不评测：** ${pb.doesNotEvaluate_zh.join('；')}。

${pb.referenceLabels_zh}

${pb.scoreTolerance_zh}

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

## ${re.sectionTitle_zh}

**探索性 — 不在稿件主范围。** ${re.outsidePrimaryManuscriptScope_zh.join(' ')}

**${re.disclaimer_zh}** \`engineType: ${re.engineType}\` · 版本：\`${re.version}\`。置信度上限 ${re.confidenceCap}。

| 领域 | 权重 |
|------|------|
${re.domainWeights.map((d) => `| ${d.domain} | ${(d.weight * 100).toFixed(0)}% |`).join('\n')}

诚实 API 字段：\`overallBhiTier\`、\`attentionScore\`、\`evidenceAdjustedAttentionScore\`、\`signalLevel\`、\`heuristicSupport\`、\`referenceDomainLabel\`、\`domainWeightedSummaries\`。已弃用别名（前端不展示）：${re.apiFields.deprecatedAliases.join('、')}。

融合展示权重（wearable ${re.fusionWeights.wearable} / clinical ${re.fusionWeights.clinical} / behavioral ${re.fusionWeights.behavioral}）：${re.fusionWeightsDisclaimer_zh}

已移除声明：${re.removedClaims.join('；')}。

## 可选 ONNX 推理后端

**${onnx.defaultCore_zh}**

| 项 | 说明 |
|----|------|
| 开启开关 | \`${onnx.enableFlag}\` |
| 模型文件 | \`${onnx.modelArtifact}\` |
| 训练脚本 | \`${onnx.trainingScript}\` |
| 训练数据 | ${onnx.trainingData_zh} |
| 标签目标 | ${onnx.labelTarget_zh} |
| 运行时 | ${onnx.runtime} |
| 用于 | ${onnx.usedIn} |
| **不用于** | ${onnx.notUsedIn} |
| 回退 | \`${onnx.fallback}\` — ${onnx.fallbackBehavior_zh} |

实现：\`${onnx.implementation}\`。${onnx.disclaimer_zh}

## 鲁棒性测试

**${rb.expectation_zh}**

${rb.scenarios_zh.map((s) => `- ${s}`).join('\n')}

## 探索性队列情景模拟（不在稿件主范围）

**${co.disclaimer_zh}**

公开参数：${co.publicParameters.join('、')}。  
情景：${co.scenarios.join('、')}（\`GET /api/outcomes/scenarios\`）。

## 双模式架构

| 模式 | 数据 | 分析 | AI |
|------|------|------|-----|
| 合成评测 | 合成基准队列（seed=42） | BHI + MAD + 规则引擎 | 规则引擎 |
| 真实数据（local-first） | Apple Health 导入 | BHI + MAD + 规则引擎 | 可选 LLM + 同一核心 |

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
  optionalOnnxBackend,
  robustnessTests,
  ruleEngine,
  cohortSimulation,
  primaryBenchmark,
};
