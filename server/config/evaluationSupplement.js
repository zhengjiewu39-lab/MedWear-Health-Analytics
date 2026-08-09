/**
 * Read frozen evaluation supplement artifacts for API + EVALUATION.md sync.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const FILES = {
  scenarios: 'benchmarks/results/scenarios-latest.json',
  fpBurden: 'benchmarks/results/fp-burden-latest.json',
  mlComparison: 'benchmarks/results/ml-comparison-latest.json',
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
    externalDescriptive: readJson(FILES.externalDescriptive),
    regenerate: {
      scenarios: 'npm run freeze:scenarios',
      fpBurden: 'npm run analyze:fp-burden',
      mlComparison: 'npm run experiment:compare',
      externalDescriptive: 'npm run evaluate:external',
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
    lines.push('## Rule engine vs simple ML (exported features)\n');
    lines.push('> Same synthetic export — compares interpretability vs sklearn baselines. `npm run experiment:compare`.\n');
  } else {
    lines.push('## 规则引擎 vs 简单 ML（导出特征）\n');
    lines.push('> 同一合成导出 — 可解释性 vs sklearn 基线。`npm run experiment:compare`。\n');
  }

  if (s.mlComparison?.ruleEngine) {
    const re = s.mlComparison.ruleEngine;
    lines.push(`| Model | Risk accuracy / Macro F1 | Notes |`);
    lines.push(`|-------|--------------------------|-------|`);
    lines.push(`| Rule engine | risk ${re.riskAccuracy}, alert F1 ${re.alertF1} | vs clinical gold |`);
    (s.mlComparison.nodeBaselines || []).forEach((m) => {
      lines.push(`| ${m.name} | acc ${m.accuracy}, F1 ${m.macroF1} | node baseline |`);
    });
    (s.mlComparison.mlModels || []).forEach((m) => {
      lines.push(`| ${m.name} (sklearn) | acc ${m.accuracy}, F1 ${m.macroF1} | 5-fold CV |`);
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
    lines.push(`- n=${e.n} · heuristic BHI-tier accuracy=${e.heuristicBhiTierAccuracy}`);
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
