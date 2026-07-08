/**
 * Unit tests for {@link module:scripts/evaluate-public-health} — paper evaluation metrics.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  run,
  evaluateScenario,
  computeSummary,
  toCsv,
  expectedPositive,
  predictedPositive,
  loadDataset,
} = require('../../scripts/evaluate-public-health');

const DATASET = loadDataset('public-health');

/** @param {string} id */
function findCase(id) {
  const scenario = DATASET.cases.find((c) => c.id === id);
  assert.ok(scenario, `expected scenario ${id} in dataset`);
  return scenario;
}

describe('evaluate-public-health — ground truth helpers', () => {
  it('expectedPositive returns true for cluster and trend positives', () => {
    assert.equal(expectedPositive({ expected: { cluster_detected: true } }), true);
    assert.equal(expectedPositive({ expected: { regional_trend_alert: true } }), true);
    assert.equal(expectedPositive({ expected: { cluster_detected: false } }), false);
  });

  it('predictedPositive routes trend cases to Level 3', () => {
    const pipeline = {
      level1: { anomalies_recorded: 3 },
      level2: { clusters_detected: 0, top_cluster: null },
      level3: { regional_trend_alert: true },
    };
    assert.equal(
      predictedPositive(pipeline, { expected: { regional_trend_alert: true } }),
      true,
    );
  });
});

describe('evaluate-public-health — evaluateScenario', () => {
  it('marks PH-301 as true positive with lead time', () => {
    const result = evaluateScenario(findCase('PH-301'), 72);
    assert.equal(result.case_id, 'PH-301');
    assert.equal(result.detected, true);
    assert.equal(result.true_positive, true);
    assert.equal(result.lead_time, 36);
    assert.equal(result.lead_time_hours, 36);
    assert.ok(result.level2.clusters_detected >= 1);
    assert.ok(result.severity_accuracy != null);
  });

  it('marks PH-804 borderline case as true negative', () => {
    const result = evaluateScenario(findCase('PH-804'), 72);
    assert.equal(result.detected, false);
    assert.equal(result.expected_detection, false);
    assert.equal(result.true_negative, true);
    assert.equal(result.false_positive, false);
  });
});

describe('evaluate-public-health — computeSummary', () => {
  it('computes confusion matrix and category metrics', () => {
    const rows = [
      { true_positive: true, false_positive: false, false_negative: false, true_negative: false, category: 'workplace_cluster', lead_time_hours: 36, preventable_cases_estimated: 2 },
      { true_positive: false, false_positive: false, false_negative: false, true_negative: true, category: 'borderline_false_positive', lead_time_hours: null, preventable_cases_estimated: 0 },
    ];
    const summary = computeSummary(rows);
    assert.equal(summary.confusion_matrix.tp, 1);
    assert.equal(summary.confusion_matrix.tn, 1);
    assert.equal(summary.overall_sensitivity, 1);
    assert.equal(summary.overall_specificity, 1);
    assert.equal(summary.average_lead_time, 36);
    assert.equal(summary.cases_prevented_estimated, 2);
    assert.ok(summary.by_category.workplace_cluster);
    assert.ok(summary.by_category.borderline_false_positive);
  });
});

describe('evaluate-public-health — toCsv', () => {
  it('emits header and data rows for paper tables', () => {
    const result = evaluateScenario(findCase('PH-301'), 72);
    const csv = toCsv([result]);
    const lines = csv.trim().split('\n');
    assert.equal(lines.length, 2);
    assert.ok(lines[0].includes('case_id'));
    assert.ok(lines[0].includes('lead_time'));
    assert.ok(lines[1].startsWith('PH-301,'));
  });
});

describe('evaluate-public-health — run', () => {
  it('returns full report structure for entire dataset', () => {
    const report = run({ dataset: 'public-health', timeWindow: 72 });
    assert.equal(report.total_cases, DATASET.case_count);
    assert.ok(report.summary_metrics.overall_sensitivity >= 0);
    assert.ok(report.summary_metrics.overall_specificity >= 0);
    assert.ok(Array.isArray(report.results));
    assert.equal(report.results.length, report.total_cases);
    assert.ok(report.engine);
    assert.ok(report.evaluation_date);
  });

  it('writes reproducible JSON when invoked as library', () => {
    const tmpDir = path.join(__dirname, '../../benchmarks/results');
    const outPath = path.join(tmpDir, 'ph-evaluation-test-run.json');
    const report = run({ dataset: 'public-health', timeWindow: 72 });
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
    const loaded = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    assert.equal(loaded.total_cases, report.total_cases);
    assert.equal(loaded.summary_metrics.confusion_matrix.tp, report.summary_metrics.confusion_matrix.tp);
    fs.unlinkSync(outPath);
  });
});
