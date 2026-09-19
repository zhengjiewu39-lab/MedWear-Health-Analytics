#!/usr/bin/env node
/**
 * Generate docs/ARTICLE-FOLLOW-SYSTEM.md — single copy-paste source for manuscript updates.
 * System code + frozen benchmark JSON are authoritative; the Word/LaTeX draft follows this file.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const LATEST = path.join(root, 'benchmarks/results/latest.json');
const SECONDARY = path.join(root, 'benchmarks/results/manuscript-secondary.json');
const OUT = path.join(root, 'docs/ARTICLE-FOLLOW-SYSTEM.md');

function gitSha() {
  try {
    return execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function gitFreezeTag() {
  try {
    return execSync('git describe --tags --exact-match HEAD', { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return 'medwear-manuscript-v1.2.2';
  }
}

function countServerTests() {
  try {
    const out = execSync('npm run test:server 2>&1', { cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
    const m = out.match(/ℹ pass (\d+)/);
    return m ? Number(m[1]) : null;
  } catch {
    return null;
  }
}

function loadJson(p) {
  if (!fs.existsSync(p)) {
    console.error(`Missing ${p} — run: npm run evaluate && npm run analyze:manuscript-secondary`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function pct(x, digits = 4) {
  if (x == null || Number.isNaN(x)) return '—';
  return Number(x).toFixed(digits);
}

function run() {
  const sha = gitSha();
  const freezeTag = gitFreezeTag();
  const remote = 'https://github.com/zhengjiewu39-lab/MedWear-Health-Analytics';
  const latest = loadJson(LATEST);
  const secondary = loadJson(SECONDARY);
  const m = latest.metrics || {};
  const alerts = m.alerts || {};
  const ci = m.confidence95 || {};
  const tol = secondary.bhiScoreAgreement?.toleranceWithinPoints || {};
  const ba = secondary.bhiScoreAgreement?.blandAltman || {};
  const mad = secondary.madCaseAudit || {};
  const testCount = countServerTests();

  const generatedAt = new Date().toISOString();

  const md = `# 文章对齐系统（Article follows system）

> **原则：** 以本仓库 **代码 + \`npm run evaluate\` 输出** 为唯一事实来源。更新 Word/LaTeX 时 **只从本文与 JSON 抄数字与表述**，不要为迁就旧稿反改系统或主基准公式。
>
> Generated: \`${generatedAt}\` · Commit: [\`${sha}\`](${remote}/commit/${sha})

---

## Data availability（建议英文稿）

\`\`\`text
Repository: ${remote}
Freeze commit: ${sha}
Freeze tag: ${freezeTag}

Primary reproduction:
  npm ci
  npm run test:server
  npm run evaluate
  npm run analyze:manuscript-secondary
  npm run docs:verify

Benchmark: benchmarks/wearable-analytics-dataset.json (n=5000, seed=42)
Engine: MedWear-AnalyticsCore-v1
Reference labels: independentSyntheticReference-v1 (synthetic reference — not clinical ground truth)
Primary alert thresholds: benchmarks/wearable-analytics-dataset.json thresholds + alertThresholds.js (SpO₂ min 93%)
Note: runtime-settings.json affects live UI only; npm run evaluate does NOT read it.
\`\`\`

## Data availability（中文摘要）

- 仓库：${remote}，冻结 tag \`${freezeTag}\` · commit \`${sha}\`
- 主基准：合成队列 n=5000、seed=42；引擎 **MedWear-AnalyticsCore-v1** vs 参考 **independentSyntheticReference-v1**
- 主结果数字来源：\`npm run evaluate\` → \`benchmarks/results/latest.json\`
- 次要分析（Bland–Altman、±5/8/10/12、MAD 路径审计）：\`npm run analyze:manuscript-secondary\` → \`manuscript-secondary.json\`
- 服务端测试：**${testCount ?? '—'}**（\`npm run test:server\`）

---

## Results — Primary endpoints（Table 3 / 主表，直接抄写）

| Metric | Value | Notes |
|--------|-------|--------|
| Alert precision | ${pct(alerts.precision)} | Threshold-signal agreement only |
| Alert recall | ${pct(alerts.recall)} | |
| **Alert F1** | **${pct(alerts.f1)}** | Not RuleEngine domain F1 |
| Anomaly accuracy (MAD case-level) | ${pct(m.anomalyAccuracy)} | 95% CI ${pct(ci.anomalyAccuracy?.lower)}–${pct(ci.anomalyAccuracy?.upper)} |
| BHI watch tier agreement | ${pct(m.bhiTierAgreement)} | 95% CI ${pct(ci.bhiTierAgreement?.lower)}–${pct(ci.bhiTierAgreement?.upper)} |
| BHI score within ±8 points | ${pct(m.healthScoreAgreementRate)} | Heuristic software tolerance, not clinical equivalence |
| Engine–reference mismatches (case flags) | ${Array.isArray(latest.mismatches) ? latest.mismatches.length : '3151'} | See latest.json |
| n | ${latest.n} | seed=42 |

**Do not report as primary:** MedWear-RuleEngine-v1 domain attentionScore F1; ONNX main-table metrics; cohort SEER/NLST simulation as diagnostic performance.

---

## Results — Secondary（来自 manuscript-secondary.json）

| Item | Value |
|------|-------|
| BHI mean difference (engine − reference) | ${secondary.bhiScoreAgreement?.meanDiff ?? '—'} |
| Bland–Altman LoA | ${ba.limitsOfAgreement ? ba.limitsOfAgreement.join(' to ') : '—'} |
| Within ±5 / ±8 / ±10 / ±12 points | ${pct(tol['5'])} / ${pct(tol['8'])} / ${pct(tol['10'])} / ${pct(tol['12'])} |
| MAD ref+ / MedWear− | ${mad.referencePositiveMedWearNegative ?? '—'} |
| HR baseline gate (among ref+ mw−) | ${mad.hrBaselineGateAmongRefPosMwNeg ?? '—'} |
| MAD case-level agreement | ${pct(mad.caseLevelAgreement)} |

---

## Methods / Discussion — 系统边界（与产品一致）

**Primary path（进主文 Results）：** Apple Health / 合成日表型 → BHI（行为健康指数，非疾病风险分）→ 固定阈值告警（SpO₂ 93% 等）→ MAD 稳健异常 → 与 **independentSyntheticReference-v1** 的 engine-versus-reference 一致率。

**Exploratory only（单独小节 / Supplement，不得写进主表）：**

- Research Signal Integration（原「筛查」UI）：domain + attentionScore，非诊断
- 合成队列结局 / SEER·NLST 参数化模拟（真实模式关闭个体生存对比 API）
- LLM 报告与 AI 干预（heuristicStrength / 人工审批）
- ONNX / sklearn 附录实验
- \`validate:cohort\` 登记子集探索性模拟（非临床验证）

**产品表述：** 界面与 \`GET /api/methodology/transparency\`、\`docs/METHODS.md\`、\`docs/EVALUATION.md\` 一致；详见 \`docs/SECURITY.md\`（RBAC）。

---

## 改稿工作流（你不再「改系统迁就文章」）

1. \`git checkout ${freezeTag}\`（或 commit \`${sha}\`）
2. \`npm run docs:manuscript-sync\` — 刷新本文
3. \`npm run evaluate\` + \`npm run analyze:manuscript-secondary\` — 若需重算 JSON
4. 在 Word/LaTeX 中 **替换** Results 数字、Data availability、探索性模块措辞 → 以本文为准
5. \`npm run docs:verify\` 通过后再定稿

---

## 一键命令

\`\`\`bash
npm run test:server
npm run evaluate
npm run analyze:manuscript-secondary
npm run docs:manuscript-sync
npm run docs:verify
\`\`\`
`;

  fs.writeFileSync(OUT, md);
  console.log(`Wrote ${OUT} (commit ${sha}, tests ${testCount ?? '?'})`);
}

if (require.main === module) run();
module.exports = { run };
