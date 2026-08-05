#!/usr/bin/env node
/**
 * Reproducible evaluation of MedWear analytics pipeline
 * Usage: node scripts/evaluate-analytics.js [--output benchmarks/results/latest.json]
 */

const fs = require('fs');
const path = require('path');
const { evaluateCase } = require('../server/services/analyticsCore');
const { isCircularMetrics, wearable: wearablePolicy } = require('../server/config/evaluationFramework');

const DATASET = path.join(__dirname, '../benchmarks/wearable-analytics-dataset.json');
const DEFAULT_OUT = path.join(__dirname, '../benchmarks/results/latest.json');

function setMatch(expected, actual) {
  const e = new Set(expected || []);
  const a = new Set(actual || []);
  if (e.size === 0 && a.size === 0) return { tp: 0, fp: 0, fn: 0, match: true };
  let tp = 0;
  e.forEach(x => { if (a.has(x)) tp++; });
  const fp = [...a].filter(x => !e.has(x)).length;
  const fn = [...e].filter(x => !a.has(x)).length;
  return { tp, fp, fn, match: fp === 0 && fn === 0 };
}

function prf1(tp, fp, fn) {
  const precision = tp + fp > 0 ? tp / (tp + fp) : tp === 0 && fp === 0 ? 1 : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : tp === 0 && fn === 0 ? 1 : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  return { precision: +precision.toFixed(4), recall: +recall.toFixed(4), f1: +f1.toFixed(4) };
}

/** Wilson score 95% CI for binomial proportion (clinical performance reporting). */
function wilsonCI(successes, n, z = 1.96) {
  if (!n) return { lower: 0, upper: 0, point: 0 };
  const p = successes / n;
  const denom = 1 + (z ** 2) / n;
  const centre = p + (z ** 2) / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p) + (z ** 2) / (4 * n)) / n);
  return {
    point: +p.toFixed(4),
    lower: +Math.max(0, (centre - margin) / denom).toFixed(4),
    upper: +Math.min(1, (centre + margin) / denom).toFixed(4),
  };
}

function run() {
  const dataset = JSON.parse(fs.readFileSync(DATASET, 'utf8'));
  const thresholds = dataset.thresholds || {};
  const results = {
    dataset: dataset.dataset,
    version: dataset.version,
    evaluatedAt: new Date().toISOString(),
    n: dataset.cases.length,
    engine: 'MedWear-AnalyticsCore-v1',
    metrics: {},
    cases: [],
    mismatches: [],
  };

  let alertTp = 0; let alertFp = 0; let alertFn = 0;
  let anomalyCorrect = 0;
  let riskCorrect = 0;
  let scoreInRange = 0;

  dataset.cases.forEach(c => {
    const pred = evaluateCase(c, thresholds);
    const alertMatch = setMatch(c.expected.alerts, pred.alerts);
    alertTp += alertMatch.tp;
    alertFp += alertMatch.fp;
    alertFn += alertMatch.fn;

    const anomalyOk = pred.anomalyDetected === c.expected.anomaly;
    if (anomalyOk) anomalyCorrect++;

    const riskOk = pred.riskLevel === c.expected.riskLevel;
    if (riskOk) riskCorrect++;

    const scoreOk = (() => {
      if (pred.healthScore == null) return false;
      const ref = c.expected.referenceScore;
      if (ref != null) return Math.abs(pred.healthScore - ref) <= 8;
      const lo = c.expected.healthScoreMin || 0;
      const hi = c.expected.healthScoreMax ?? 100;
      return pred.healthScore >= lo && pred.healthScore <= hi;
    })();
    if (scoreOk) scoreInRange++;

    const row = {
      id: c.id,
      label: c.label,
      predicted: pred,
      expected: c.expected,
      alertExactMatch: alertMatch.match,
      anomalyOk,
      riskOk,
      scoreOk,
    };
    results.cases.push(row);

    if (!alertMatch.match || !anomalyOk || !riskOk || !scoreOk) {
      results.mismatches.push(row);
    }
  });

  const n = dataset.cases.length;
  results.metrics = {
    alerts: prf1(alertTp, alertFp, alertFn),
    alertExactMatchRate: +(results.cases.filter(c => c.alertExactMatch).length / n).toFixed(4),
    anomalyAccuracy: +(anomalyCorrect / n).toFixed(4),
    riskAccuracy: +(riskCorrect / n).toFixed(4),
    healthScoreAgreementRate: +(scoreInRange / n).toFixed(4),
    healthScoreInRangeRate: +(scoreInRange / n).toFixed(4),
    confidence95: {
      alertExactMatch: wilsonCI(results.cases.filter(c => c.alertExactMatch).length, n),
      anomalyAccuracy: wilsonCI(anomalyCorrect, n),
      riskAccuracy: wilsonCI(riskCorrect, n),
      healthScoreAgreement: wilsonCI(scoreInRange, n),
      healthScoreInRange: wilsonCI(scoreInRange, n),
    },
  };

  const suspicious = isCircularMetrics(results.metrics);
  if (suspicious) {
    results.circularLabelWarning = wearablePolicy.invalidIf_en;
    results.integrity = 'invalid-circular';
  } else {
    results.integrity = 'independent-gold';
  }
  results.goldStandard = wearablePolicy.goldStandard;
  results.evaluationModel = wearablePolicy.evaluationModel;

  return results;
}

if (require.main === module) {
  const out = process.argv.includes('--output')
    ? process.argv[process.argv.indexOf('--output') + 1]
    : DEFAULT_OUT;
  const results = run();
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(results, null, 2));
  console.log(`MedWear Analytics Evaluation — n=${results.n}`);
  console.log(`  Alert F1:        ${results.metrics.alerts.f1}`);
  console.log(`  Anomaly Acc:     ${results.metrics.anomalyAccuracy}`);
  console.log(`  Risk Acc:        ${results.metrics.riskAccuracy}`);
  console.log(`  Score agreement: ${results.metrics.healthScoreAgreementRate}`);
  if (results.metrics.confidence95) {
    const c = results.metrics.confidence95;
    console.log(`  95% CI anomaly:  ${c.anomalyAccuracy.lower}–${c.anomalyAccuracy.upper}`);
    console.log(`  95% CI risk:     ${c.riskAccuracy.lower}–${c.riskAccuracy.upper}`);
    console.log(`  95% CI score:    ${c.healthScoreAgreement.lower}–${c.healthScoreAgreement.upper}`);
  }
  if (results.circularLabelWarning) console.warn(`  ⚠ ${results.circularLabelWarning}`);
  console.log(`  Mismatches:      ${results.mismatches.length}`);
  console.log(`  → ${out}`);
}

module.exports = { run };
