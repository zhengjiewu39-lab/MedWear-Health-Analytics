/**
 * Read frozen evaluation supplement artifacts for API + EVALUATION.md sync.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const FILES = {
  scenarios: 'benchmarks/results/scenarios-latest.json',
  fpBurden: 'benchmarks/results/fp-burden-latest.json',
  mlComparison: 'benchmarks/results/ml-comparison-fair-latest.json',
  mlComparisonOracle: 'benchmarks/results/ml-comparison-oracle-latest.json',
  mlComparisonVsGold: 'benchmarks/results/ml-comparison-vs-gold-latest.json',
  sensitivityOutcomes: 'benchmarks/results/sensitivity-outcomes-latest.json',
  externalDescriptive: 'benchmarks/results/external-descriptive-latest.json',
};

function readJson(rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function getEvaluationSupplement() {
  return {
    generatedAt: new Date().toISOString(),
    scenarios: readJson(FILES.scenarios),
    fpBurden: readJson(FILES.fpBurden),
    mlComparison: readJson(FILES.mlComparison),
    mlComparisonOracle: readJson(FILES.mlComparisonOracle),
    mlComparisonVsGold: readJson(FILES.mlComparisonVsGold),
    sensitivityOutcomes: readJson(FILES.sensitivityOutcomes),
    externalDescriptive: readJson(FILES.externalDescriptive),
    regenerate: {
      scenarios: 'npm run freeze:scenarios',
      fpBurden: 'npm run analyze:fp-burden',
      mlComparison: 'npm run experiment:compare-fair',
      mlComparisonOracle: 'npm run experiment:compare-oracle',
      mlComparisonVsGold: 'npm run experiment:compare-vs-gold',
      sensitivityOutcomes: 'npm run sensitivity:outcomes',
      externalDescriptive: 'npm run evaluate:public',
      all: 'npm run evaluate:supplement',
    },
  };
}

function renderSupplementMarkdown(isEn = true) {
  const s = getEvaluationSupplement();
  const lines = [];

  if (isEn) {
    lines.push('## Frozen scenario sensitivity (conservative / neutral / optimistic)\n');
    lines.push('> Parameter-driven exploratory simulation — no p-values. Regenerate: `npm run freeze:scenarios`.\n');
  } else {
    lines.push('## 固化情景敏感性（conservative / neutral / optimistic）\n');
    lines.push('> 参数驱动的探索性模拟 — 无 p 值。重新生成：`npm run freeze:scenarios`。\n');
  }

  if (s.scenarios?.scenarios?.length) {
    lines.push('| Scenario | Early dx Δ | Treatment Δ | 5y survival Δ |');
    lines.push('|----------|------------|-------------|---------------|');
    s.scenarios.scenarios.forEach((row) => {
      const h = row.headline || {};
      lines.push(`| ${row.scenario} | ${h.earlyDiagnosisRate?.absoluteDelta ?? '—'} | ${h.treatmentRate?.absoluteDelta ?? '—'} | ${h.survival5y?.absoluteDelta ?? '—'} |`);
    });
    lines.push('');
  } else {
    lines.push(isEn ? '_Run `npm run freeze:scenarios` to populate._\n' : '_运行 `npm run freeze:scenarios` 生成表格。_\n');
  }

  if (isEn) {
    lines.push('## False-positive downstream burden (scenario)\n');
    lines.push('> Illustrative — not observed utilization. Regenerate: `npm run analyze:fp-burden`.\n');
  } else {
    lines.push('## 假阳性下游负担（情景估算）\n');
    lines.push('> 说明性估算 — 非真实利用数据。重新生成：`npm run analyze:fp-burden`。\n');
  }

  if (s.fpBurden?.per1000) {
    const p = s.fpBurden.per1000;
    const a = s.fpBurden.alertMetrics || {};
    lines.push(`| Per 1000 individuals | Value |`);
    lines.push(`|----------------------|-------|`);
    lines.push(`| False-positive alerts | ${p.falsePositiveAlerts} |`);
    lines.push(`| Est. follow-up workups (35% of FP) | ${p.estimatedFollowUpWorkups} |`);
    lines.push(`| Est. extra outpatient visits | ${p.estimatedExtraOutpatientVisits} |`);
    lines.push(`| Alert precision (eval) | ${a.precision ?? '—'} |`);
    lines.push('');
  }

  if (isEn) {
    lines.push('## Rule engine vs simple ML — fair comparison (raw wearable features)\n');
    lines.push('> **Primary table:** 15-dim export **without** BHI/anomaly flags. Rule engine preferred for **interpretability & auditability**, not oracle sklearn accuracy. Regenerate: `npm run experiment:compare-fair`.\n');
  } else {
    lines.push('## 规则引擎 vs 简单 ML — 公平比较（原始可穿戴特征）\n');
    lines.push('> **主表：** 15 维导出，**不含** BHI/异常标记。规则引擎因**可解释与可审计**优先，而非 oracle sklearn 准确率。`npm run experiment:compare-fair`。\n');
  }

  if (s.mlComparison?.ruleEngine) {
    const re = s.mlComparison.ruleEngine;
    lines.push(`| Model | BHI tier accuracy / Macro F1 | Notes |`);
    lines.push(`|-------|------------------------------|-------|`);
    lines.push(`| Rule engine (vs clinical gold) | risk ${re.riskAccuracy}, alert F1 ${re.alertF1 ?? '—'} | product metric |`);
    (s.mlComparison.nodeBaselines || []).forEach((m) => {
      lines.push(`| ${m.name} | acc ${m.accuracy}, F1 ${m.macroF1} | node baseline |`);
    });
    (s.mlComparison.mlModels || []).forEach((m) => {
      lines.push(`| ${m.name} (sklearn, fair) | acc ${m.accuracy}, F1 ${m.macroF1} | 5-fold CV, raw features |`);
    });
    lines.push('');
    lines.push(isEn
      ? '> **Fair ML note:** Sklearn targets are **product-engine BHI watch tiers** (not gold labels). 5-fold CV uses random stratified splits on the same synthetic export. High accuracy reflects **feature distinguishability ceiling** on correlated synthetic data — **not** independent clinical validation. Rule engine is preferred for interpretability, not because sklearn "loses" on oracle features.'
      : '> **公平 ML 说明：** sklearn 目标为**产品引擎 BHI 关注分层**（非 gold 标签）。5-fold CV 为同导出集上的随机分层分割。高准确率反映合成数据上的**特征可区分性上限** — **非**独立临床验证。规则引擎因可解释性优先，而非 oracle 特征上 sklearn 更差。');
    lines.push('');
  } else {
    lines.push(isEn ? '_Run `npm run experiment:compare-fair` to populate._\n' : '_运行 `npm run experiment:compare-fair` 生成表格。_\n');
  }

  if (isEn) {
    lines.push('### Appendix: oracle comparison (engine-derived features — feature leakage)\n');
    lines.push('> Includes `health_score_norm` + `anomaly_flag`. High sklearn CV (~0.94–0.98) is **not** independent validation. `npm run experiment:compare-oracle`.\n');
  } else {
    lines.push('### 附录：oracle 比较（含引擎衍生特征 — 特征泄露）\n');
    lines.push('> 含 `health_score_norm` + `anomaly_flag`。sklearn CV 高（~0.94–0.98）**非**独立验证。`npm run experiment:compare-oracle`。\n');
  }

  if (s.mlComparisonOracle?.mlModels?.length) {
    lines.push(`| Model | Accuracy / Macro F1 | Notes |`);
    lines.push(`|-------|---------------------|-------|`);
    s.mlComparisonOracle.mlModels.forEach((m) => {
      lines.push(`| ${m.name} (sklearn, oracle) | acc ${m.accuracy}, F1 ${m.macroF1} | appendix only |`);
    });
    lines.push('');
  }

  if (isEn) {
    lines.push('### Gold-tier ML comparison (clinicalGoldStandard-v1 labels)\n');
    lines.push('> Sklearn trained to predict **reference risk tier** from raw features. Regenerate: `npm run experiment:compare-vs-gold`.\n');
  } else {
    lines.push('### Gold 分层 ML 对比（clinicalGoldStandard-v1 标签）\n');
    lines.push('> sklearn 预测**参考风险分层**（原始特征）。`npm run experiment:compare-vs-gold`。\n');
  }

  if (s.mlComparisonVsGold?.ruleEngine) {
    const g = s.mlComparisonVsGold;
    lines.push(`| Model | Gold-tier accuracy / Macro F1 | Notes |`);
    lines.push(`|-------|-------------------------------|-------|`);
    lines.push(`| Rule engine (engine-vs-gold) | ${g.ruleEngine.goldTierAgreement}, alert F1 ${g.ruleEngine.alertF1 ?? '—'} | product vs gold reference |`);
    (g.nodeBaselines || []).forEach((m) => {
      lines.push(`| ${m.name} | acc ${m.accuracy}, F1 ${m.macroF1} | node baseline |`);
    });
    (g.mlModels || []).forEach((m) => {
      lines.push(`| ${m.name} (sklearn, vs gold) | acc ${m.accuracy}, F1 ${m.macroF1} | 5-fold CV, gold label target |`);
    });
    lines.push('');
  }

  if (isEn) {
    lines.push('## Parameter sensitivity (outcome simulation)\n');
    lines.push('> Outcomes highly parameter-driven — tornado from `npm run sensitivity:outcomes`.\n');
  } else {
    lines.push('## 参数敏感性（结局模拟）\n');
    lines.push('> 结局高度依赖参数 — `npm run sensitivity:outcomes` 生成 tornado。\n');
  }

  if (s.sensitivityOutcomes?.tornado?.length) {
    lines.push(`| Parameter perturbation | Metric | Baseline | Perturbed | Δ |`);
    lines.push(`|------------------------|--------|----------|-----------|---|`);
    s.sensitivityOutcomes.tornado.forEach((row) => {
      lines.push(`| ${row.parameter} | ${row.metric} | ${row.baseline} | ${row.perturbed} | ${row.delta} |`);
    });
    lines.push('');
  }

  if (isEn) {
    lines.push('## Portable feature / external dataset baseline\n');
    lines.push('> Descriptive check on exported 17-dim rows; WESAD/PPG-DaLiA require separate adapters. See [EXTERNAL-VALIDATION.md](./EXTERNAL-VALIDATION.md).\n');
  } else {
    lines.push('## 可移植特征 / 外部数据集基线\n');
    lines.push('> 17 维导出特征描述性检查；WESAD/PPG-DaLiA 需单独适配。见 [EXTERNAL-VALIDATION.zh.md](./EXTERNAL-VALIDATION.zh.md)。\n');
  }

  if (s.externalDescriptive) {
    const e = s.externalDescriptive;
    if (e.wesadStressProxy) {
      const w = e.wesadStressProxy;
      lines.push(`- WESAD stress proxy (**sanity check only — not validation**): n=${w.n} · BHI-tier acc=${w.heuristicBhiTierAccuracy} · anomaly agree=${w.anomalyFlagAgreement ?? '—'} · stress-binary AUC(BHI)=${w.stressBinaryAucBhi ?? '—'} · AUC(anomaly)=${w.stressBinaryAucAnomaly ?? '—'}`);
    }
    if (e.internalExport) {
      lines.push(`- Internal export: n=${e.internalExport.n} · BHI-tier acc=${e.internalExport.heuristicBhiTierAccuracy}`);
    }
    lines.push(`- Planned external: ${(e.externalDatasetsPlanned || []).join(', ')}`);
    lines.push('');
  }

  return lines.join('\n');
}

function syncEvaluationSupplement(rootDir = ROOT) {
  const markerStart = '<!-- EVAL-SUPPLEMENT-START -->';
  const markerEnd = '<!-- EVAL-SUPPLEMENT-END -->';
  const block = `${markerStart}\n${renderSupplementMarkdown(true)}\n${markerEnd}`;
  const blockZh = `${markerStart}\n${renderSupplementMarkdown(false)}\n${markerEnd}`;

  for (const [file, content] of [
    [path.join(rootDir, 'docs/EVALUATION.md'), block],
    [path.join(rootDir, 'docs/EVALUATION.zh.md'), blockZh],
  ]) {
    let md = fs.readFileSync(file, 'utf8');
    if (md.includes(markerStart)) {
      md = md.replace(new RegExp(`${markerStart}[\\s\\S]*${markerEnd}`), content);
    } else {
      md = `${md.trim()}\n\n---\n\n${content}\n`;
    }
    fs.writeFileSync(file, md);
  }
}

module.exports = {
  getEvaluationSupplement,
  renderSupplementMarkdown,
  syncEvaluationSupplement,
};
