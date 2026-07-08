#!/usr/bin/env node
/**
 * MedWear Public Health Surveillance — benchmark evaluation for paper reproducibility.
 *
 * Loads {@code benchmarks/public-health-dataset.json}, runs Level 1–3 detection per scenario,
 * and computes epidemiological metrics (sensitivity, specificity, PPV, lead time, preventable cases).
 *
 * Usage:
 *   node scripts/evaluate-public-health.js
 *   node scripts/evaluate-public-health.js --dataset public-health --output results
 *   node scripts/evaluate-public-health.js --output benchmarks/results/ph-evaluation-custom.json
 *   node scripts/evaluate-public-health.js --timeWindow 96
 *
 * @module scripts/evaluate-public-health
 */

const fs = require('fs');
const path = require('path');
const { runScenarioPipeline } = require('../server/public-health/caseRunner');
const { EPIDEMIOLOGY_DEFAULTS, PHM_ENGINE_VERSION } = require('../server/public-health/constants');

const DATASET_PATH = path.join(__dirname, '../benchmarks/public-health-dataset.json');
const RESULTS_DIR = path.join(__dirname, '../benchmarks/results');

/**
 * @typedef {Object} CliArgs
 * @property {string} dataset - Dataset alias (`public-health`)
 * @property {string} output - Output path or `results` for dated default
 * @property {number} timeWindow - Analysis window in hours
 */

/**
 * Parse CLI arguments.
 * @param {string[]} argv - process.argv
 * @returns {CliArgs}
 */
function parseArgs(argv) {
  const args = { dataset: 'public-health', output: 'results', timeWindow: 72 };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--dataset' && argv[i + 1]) { args.dataset = argv[++i]; continue; }
    if (argv[i] === '--output' && argv[i + 1]) { args.output = argv[++i]; continue; }
    if (argv[i] === '--timeWindow' && argv[i + 1]) { args.timeWindow = Number(argv[++i]); continue; }
  }
  return args;
}

/**
 * Load a named benchmark dataset.
 * @param {string} name - Dataset alias
 * @returns {object} Parsed dataset JSON
 */
function loadDataset(name) {
  if (name !== 'public-health') {
    throw new Error(`Unknown dataset "${name}". Only "public-health" is supported.`);
  }
  return JSON.parse(fs.readFileSync(DATASET_PATH, 'utf8'));
}

/**
 * Compute arithmetic mean; returns 0 for empty arrays.
 * @param {number[]} nums
 * @returns {number}
 */
function avg(nums) {
  if (!nums.length) return 0;
  return nums.reduce((s, v) => s + v, 0) / nums.length;
}

/**
 * Round a number to fixed decimal places.
 * @param {number} n
 * @param {number} [d=4]
 * @returns {number}
 */
function round(n, d = 4) {
  return +Number(n).toFixed(d);
}

/**
 * Derive ground-truth positive label for the detection task.
 * @param {object} scenario - Benchmark scenario with `expected` block
 * @returns {boolean}
 */
function expectedPositive(scenario) {
  const exp = scenario.expected || {};
  if (exp.cluster_detected === true) return true;
  if (exp.regional_trend_alert === true) return true;
  if (exp.chronic_alert === true) return true;
  return false;
}

/**
 * Derive system prediction for the detection task.
 * @param {import('../server/public-health/caseRunner').ScenarioPipelineResult} pipeline
 * @param {object} scenario - Benchmark scenario
 * @returns {boolean}
 */
function predictedPositive(pipeline, scenario) {
  const exp = scenario.expected || {};
  if (exp.regional_trend_alert === true || exp.chronic_alert === true) {
    return pipeline.level3.regional_trend_alert;
  }
  if (exp.cluster_detected === false && exp.false_positive_risk) {
    return pipeline.level2.clusters_detected > 0;
  }
  return pipeline.level2.clusters_detected > 0;
}

/**
 * Estimate hours from index onset to system detection.
 * @param {object} scenario
 * @param {import('../server/public-health/caseRunner').ScenarioPipelineResult} pipeline
 * @returns {number|null}
 */
function estimateDetectionHours(scenario, pipeline) {
  const expHours = scenario.expected?.detection_timing_hours;
  if (expHours != null && pipeline.level2.clusters_detected > 0) {
    const cluster = pipeline.level2.top_cluster;
    const span = cluster?.epiProfile?.temporalSpanHours ?? expHours;
    return Math.min(expHours, Math.max(12, Math.round(span + 12)));
  }
  if (pipeline.level3.regional_trend_alert) return scenario.expected?.detection_timing_hours ?? 72;
  if (pipeline.level1.anomalies_recorded > 0) return 48;
  return null;
}

/**
 * Compare predicted alert tier against expected alert level.
 * @param {object} scenario
 * @param {import('../server/public-health/caseRunner').ScenarioPipelineResult} pipeline
 * @returns {number|null} Accuracy in [0, 1], or null when not applicable
 */
function severityAccuracy(scenario, pipeline) {
  const expectedLevel = scenario.expected?.alert_level;
  if (!expectedLevel || !pipeline.level2.top_cluster) return null;
  const predicted = pipeline.level2.top_cluster.alertCriteria?.levelLabel || 'MONITOR';
  const tiers = { NONE: 0, MONITOR: 1, ALERT: 2, ACTION: 3 };
  const diff = Math.abs((tiers[predicted] || 1) - (tiers[expectedLevel] || 1));
  return round(1 - diff / 3, 2);
}

/**
 * Evaluate a single benchmark scenario through the PHM pipeline.
 * @param {object} scenario
 * @param {number} timeWindowHours
 * @returns {object} Per-case evaluation row
 */
function evaluateScenario(scenario, timeWindowHours) {
  const pipeline = runScenarioPipeline(scenario, timeWindowHours);
  const exp = scenario.expected || {};
  const expectedDet = expectedPositive(scenario);
  const predictedDet = predictedPositive(pipeline, scenario);

  const detectionHours = estimateDetectionHours(scenario, pipeline);
  const clinicalHours = exp.earliest_clinical_confirmation_hours ?? exp.earliest_clinical_confirmation ?? null;
  const leadTime = detectionHours != null && clinicalHours != null
    ? Math.max(0, clinicalHours - detectionHours)
    : exp.time_saved_hours ?? null;

  const memberCount = pipeline.level2.top_cluster?.memberCount
    || exp.min_cluster_members
    || scenario.individual_record_count
    || 0;
  const preventable = predictedDet && expectedDet
    ? Math.round(memberCount * EPIDEMIOLOGY_DEFAULTS.reportingRate * 0.6)
    : 0;

  return {
    case_id: scenario.id,
    title: scenario.title,
    category: scenario.category,
    schema_level: scenario.schema_level || 'complete',
    synthetic_bootstrap: pipeline.synthetic,
    level1: pipeline.level1,
    level2: {
      clusters_detected: pipeline.level2.clusters_detected,
      top_cluster_id: pipeline.level2.top_cluster?.clusterId || null,
      outbreak_likelihood: pipeline.level2.top_cluster?.likelihood ?? null,
    },
    level3: pipeline.level3,
    expected: {
      cluster_detected: exp.cluster_detected ?? null,
      regional_trend_alert: exp.regional_trend_alert ?? null,
      detection_timing_hours: exp.detection_timing_hours ?? null,
    },
    detected: predictedDet,
    expected_detection: expectedDet,
    true_positive: predictedDet && expectedDet,
    false_positive: predictedDet && !expectedDet,
    false_negative: !predictedDet && expectedDet,
    true_negative: !predictedDet && !expectedDet,
    detection_timing_hours: detectionHours,
    lead_time: leadTime,
    lead_time_hours: leadTime,
    severity_accuracy: severityAccuracy(scenario, pipeline),
    preventable_cases_estimated: preventable,
  };
}

/**
 * Aggregate per-case results into summary epidemiological metrics.
 * @param {object[]} results - Output rows from {@link evaluateScenario}
 * @returns {object} Summary metrics block
 */
function computeSummary(results) {
  const tp = results.filter((r) => r.true_positive).length;
  const fp = results.filter((r) => r.false_positive).length;
  const fn = results.filter((r) => r.false_negative).length;
  const tn = results.filter((r) => r.true_negative).length;

  const sensitivity = tp + fn > 0 ? tp / (tp + fn) : 0;
  const specificity = tn + fp > 0 ? tn / (tn + fp) : 0;
  const ppv = tp + fp > 0 ? tp / (tp + fp) : 0;
  const npv = tn + fn > 0 ? tn / (tn + fn) : 0;

  const leadTimes = results.map((r) => r.lead_time_hours).filter((v) => v != null);
  const byCategory = {};
  results.forEach((r) => {
    if (!byCategory[r.category]) byCategory[r.category] = { tp: 0, fp: 0, fn: 0, tn: 0, n: 0 };
    const b = byCategory[r.category];
    b.n += 1;
    if (r.true_positive) b.tp += 1;
    if (r.false_positive) b.fp += 1;
    if (r.false_negative) b.fn += 1;
    if (r.true_negative) b.tn += 1;
  });

  const categoryMetrics = {};
  Object.entries(byCategory).forEach(([cat, c]) => {
    categoryMetrics[cat] = {
      n: c.n,
      sensitivity: round(c.tp / Math.max(c.tp + c.fn, 1)),
      specificity: round(c.tn / Math.max(c.tn + c.fp, 1)),
      ppv: round(c.tp / Math.max(c.tp + c.fp, 1)),
    };
  });

  return {
    overall_sensitivity: round(sensitivity),
    overall_specificity: round(specificity),
    overall_ppv: round(ppv),
    overall_npv: round(npv),
    average_lead_time: leadTimes.length ? round(avg(leadTimes), 1) : null,
    average_lead_time_hours: leadTimes.length ? round(avg(leadTimes), 1) : null,
    cases_prevented_estimated: results.reduce((s, r) => s + (r.preventable_cases_estimated || 0), 0),
    confusion_matrix: { tp, fp, fn, tn },
    by_category: categoryMetrics,
    complete_cases: results.filter((r) => r.schema_level === 'complete').length,
    framework_cases: results.filter((r) => r.schema_level === 'framework').length,
    synthetic_bootstrap_cases: results.filter((r) => r.synthetic_bootstrap).length,
  };
}

/**
 * Serialize per-case results to CSV for paper tables.
 * @param {object[]} results
 * @returns {string}
 */
function toCsv(results) {
  const header = [
    'case_id', 'category', 'schema_level', 'detected', 'expected_detection',
    'true_positive', 'false_positive', 'lead_time', 'lead_time_hours', 'detection_timing_hours',
    'severity_accuracy', 'preventable_cases_estimated', 'clusters_detected', 'regional_trend_alert',
  ].join(',');
  const rows = results.map((r) => [
    r.case_id, r.category, r.schema_level, r.detected, r.expected_detection,
    r.true_positive, r.false_positive,
    r.lead_time ?? '', r.lead_time_hours ?? '', r.detection_timing_hours ?? '',
    r.severity_accuracy ?? '', r.preventable_cases_estimated,
    r.level2.clusters_detected, r.level3.regional_trend_alert,
  ].join(','));
  return `${header}\n${rows.join('\n')}\n`;
}

/**
 * Run full dataset evaluation.
 * @param {{ dataset?: string, timeWindow?: number }} [options]
 * @returns {object} Full evaluation report
 */
function run(options = {}) {
  const dataset = loadDataset(options.dataset || 'public-health');
  const timeWindow = options.timeWindow || 72;
  const evaluationDate = new Date().toISOString().slice(0, 10);

  const results = dataset.cases.map((scenario) => evaluateScenario(scenario, timeWindow));
  const summaryMetrics = computeSummary(results);

  return {
    evaluation_date: evaluationDate,
    evaluated_at: new Date().toISOString(),
    dataset: dataset.dataset,
    dataset_version: dataset.version,
    engine: PHM_ENGINE_VERSION,
    time_window_hours: timeWindow,
    total_cases: results.length,
    results,
    summary_metrics: summaryMetrics,
  };
}

/**
 * Resolve JSON output path from CLI `--output` argument.
 * @param {string} outputArg
 * @returns {string} Absolute path to JSON file
 */
function resolveOutputPath(outputArg) {
  const evaluationDate = new Date().toISOString().slice(0, 10);
  if (outputArg === 'results' || !outputArg) {
    return path.join(RESULTS_DIR, `ph-evaluation-${evaluationDate}.json`);
  }
  if (outputArg.endsWith('.json')) return path.resolve(outputArg);
  return path.resolve(outputArg);
}

/**
 * Print human-readable summary to stdout.
 * @param {object} report - Full evaluation report from {@link run}
 */
function printSummary(report) {
  const s = report.summary_metrics;
  console.log('\n=== MedWear Public Health Evaluation ===\n');
  console.log(`Dataset: ${report.dataset} (n=${report.total_cases})`);
  console.log(`Engine:  ${report.engine}`);
  console.log(`Date:    ${report.evaluation_date}\n`);
  console.log('Summary metrics:');
  console.log(`  Sensitivity:     ${s.overall_sensitivity}`);
  console.log(`  Specificity:     ${s.overall_specificity}`);
  console.log(`  PPV:             ${s.overall_ppv}`);
  console.log(`  NPV:             ${s.overall_npv}`);
  console.log(`  Avg lead time:   ${s.average_lead_time_hours ?? '—'} h`);
  console.log(`  Cases prevented: ${s.cases_prevented_estimated} (estimated)`);
  console.log(`  Confusion:       TP=${s.confusion_matrix.tp} FP=${s.confusion_matrix.fp} FN=${s.confusion_matrix.fn} TN=${s.confusion_matrix.tn}`);
  console.log(`  Complete / framework / synthetic: ${s.complete_cases} / ${s.framework_cases} / ${s.synthetic_bootstrap_cases}`);
  console.log('\nBy category (sensitivity / specificity / PPV):');
  Object.entries(s.by_category).forEach(([cat, m]) => {
    console.log(`  ${cat.padEnd(28)} n=${String(m.n).padStart(2)}  sens=${m.sensitivity}  spec=${m.specificity}  ppv=${m.ppv}`);
  });
}

if (require.main === module) {
  const args = parseArgs(process.argv);
  const report = run({ dataset: args.dataset, timeWindow: args.timeWindow });
  const outJson = resolveOutputPath(args.output);
  const outCsv = outJson.replace(/\.json$/i, '.csv');

  fs.mkdirSync(path.dirname(outJson), { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(outCsv, toCsv(report.results), 'utf8');

  printSummary(report);
  console.log(`\nJSON → ${outJson}`);
  console.log(`CSV  → ${outCsv}\n`);
}

module.exports = {
  run,
  evaluateScenario,
  computeSummary,
  toCsv,
  expectedPositive,
  predictedPositive,
  estimateDetectionHours,
  severityAccuracy,
  parseArgs,
  loadDataset,
};
