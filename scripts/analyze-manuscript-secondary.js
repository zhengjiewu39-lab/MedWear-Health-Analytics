#!/usr/bin/env node
/**
 * Frozen secondary analyses for the MedWear manuscript v1.2.
 *
 * Reproduces, from the frozen n=5000 benchmark:
 * - BHI tolerance sensitivity at ±5, ±8, ±10 and ±12 points
 * - MAE, median absolute difference and IQR
 * - descriptive Bland–Altman mean difference and 95% limits of agreement
 * - score-dependent difference diagnostics
 * - rule-path audit of reference-positive / MedWear-negative MAD cases
 *
 * These are deterministic computational comparisons, not clinical validation.
 */

const fs = require('fs');
const path = require('path');
const { evaluateCase } = require('../server/services/analyticsCore');

const ROOT = path.join(__dirname, '..');
const DATASET = path.join(ROOT, 'benchmarks/wearable-analytics-dataset.json');
const DEFAULT_OUT = path.join(ROOT, 'benchmarks/results/manuscript-secondary-v1.2.json');
const TOLERANCES = [5, 8, 10, 12];

function parseOut() {
  const args = process.argv.slice(2);
  const i = args.indexOf('--output');
  return i >= 0 && args[i + 1] ? path.resolve(args[i + 1]) : DEFAULT_OUT;
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function sampleSd(values) {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - m) ** 2, 0) / (values.length - 1));
}

function quantile(values, probability) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * probability;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function pearson(x, y) {
  const mx = mean(x);
  const my = mean(y);
  let numerator = 0;
  let xss = 0;
  let yss = 0;
  x.forEach((value, index) => {
    const dx = value - mx;
    const dy = y[index] - my;
    numerator += dx * dy;
    xss += dx ** 2;
    yss += dy ** 2;
  });
  return xss && yss ? numerator / Math.sqrt(xss * yss) : 0;
}

function rank(values) {
  const order = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const ranks = new Array(values.length);
  let start = 0;
  while (start < order.length) {
    let end = start + 1;
    while (end < order.length && order[end].value === order[start].value) end += 1;
    const averageRank = (start + 1 + end) / 2;
    for (let i = start; i < end; i += 1) ranks[order[i].index] = averageRank;
    start = end;
  }
  return ranks;
}

function sleepHours(sleep = {}) {
  return ((sleep.deep || 0) + (sleep.rem || 0) + (sleep.light || 0)) / 60;
}

function referenceAnomalyMechanisms(caseData) {
  const days = caseData.days || {};
  const keys = Object.keys(days).sort().slice(-7);
  const mechanisms = [];
  const allHr = keys.flatMap((key) => days[key].heartRate || []);

  if (allHr.length >= 8) {
    const hrMean = mean(allHr);
    const hrSd = Math.sqrt(mean(allHr.map((value) => (value - hrMean) ** 2)));
    const hasHrVariability = keys.some((key) => (
      (days[key].heartRate || []).filter((value) => value > hrMean + 1.8 * hrSd).length >= 2
    ));
    if (hasHrVariability) mechanisms.push('hr_variability');
  }

  if (keys.some((key) => (days[key].spo2 || []).filter((value) => value < 94).length >= 2)) {
    mechanisms.push('spo2_events');
  }
  if (keys.some((key) => sleepHours(days[key].sleepMinutes) > 0 && sleepHours(days[key].sleepMinutes) < 5.5)) {
    mechanisms.push('sleep_deprivation');
  }

  const targetDay = caseData.targetDay || keys[keys.length - 1];
  const steps = days[targetDay]?.steps || 0;
  if (steps > 0 && steps < 2500) mechanisms.push('sedentary_target');
  return mechanisms;
}

function eligibleHrBaselineCount(caseData) {
  const days = caseData.days || {};
  return Object.keys(days).sort().slice(-14).reduce((count, key) => {
    if ((days[key].steps || 0) >= 6500) return count;
    return count + (days[key].heartRate || []).length;
  }, 0);
}

function countBy(values) {
  return values.reduce((counts, value) => {
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

function run() {
  const dataset = JSON.parse(fs.readFileSync(DATASET, 'utf8'));
  const cases = dataset.cases.map((caseData) => {
    const predicted = evaluateCase(caseData, dataset.thresholds || {});
    return { caseData, predicted };
  });

  const scorePairs = cases.map(({ caseData, predicted }) => ({
    id: caseData.id,
    reference: caseData.expected.referenceScore,
    medwear: predicted.healthScore,
  })).filter((row) => row.reference != null && row.medwear != null);
  const differences = scorePairs.map((row) => row.medwear - row.reference);
  const absoluteDifferences = differences.map(Math.abs);
  const pairwiseMeans = scorePairs.map((row) => (row.medwear + row.reference) / 2);
  const meanDifference = mean(differences);
  const differenceSd = sampleSd(differences);

  const toleranceSensitivity = Object.fromEntries(TOLERANCES.map((tolerance) => {
    const count = absoluteDifferences.filter((value) => value <= tolerance).length;
    return [`plusMinus${tolerance}`, { tolerance, count, proportion: count / scorePairs.length }];
  }));

  const bins = [[0, 40], [40, 60], [60, 80], [80, 101]].map(([lower, upper]) => {
    const binDifferences = differences.filter((_, index) => (
      pairwiseMeans[index] >= lower && pairwiseMeans[index] < upper
    ));
    return {
      pairwiseMeanRange: `[${lower}, ${upper === 101 ? 100 : upper})`,
      n: binDifferences.length,
      meanDifference: mean(binDifferences),
      differenceSd: sampleSd(binDifferences),
      meanAbsoluteDifference: mean(binDifferences.map(Math.abs)),
    };
  });

  const madFalseNegatives = cases.filter(({ caseData, predicted }) => (
    caseData.expected.anomaly === true && predicted.anomalyDetected === false
  ));
  const stoppedByMinimumBaseline = madFalseNegatives.filter(({ caseData }) => (
    eligibleHrBaselineCount(caseData) < 10
  ));
  const passedMinimumBaseline = madFalseNegatives.filter(({ caseData }) => (
    eligibleHrBaselineCount(caseData) >= 10
  ));
  const passedMechanisms = passedMinimumBaseline.flatMap(({ caseData }) => referenceAnomalyMechanisms(caseData));
  const allMechanisms = madFalseNegatives.flatMap(({ caseData }) => referenceAnomalyMechanisms(caseData));

  const payload = {
    analysisProtocol: 'MedWear-Manuscript-Secondary-v1.2',
    dataset: dataset.dataset,
    datasetVersion: dataset.version,
    n: dataset.cases.length,
    seed: dataset.seed,
    productEngine: 'MedWear-AnalyticsCore-v1',
    reference: 'independentSyntheticReference-v1',
    interpretation: 'descriptive deterministic computational agreement; not clinical validation or interchangeability',
    continuousBhi: {
      nPairs: scorePairs.length,
      toleranceSensitivity,
      meanDifferenceMedWearMinusReference: meanDifference,
      meanAbsoluteDifference: mean(absoluteDifferences),
      medianAbsoluteDifference: quantile(absoluteDifferences, 0.5),
      absoluteDifferenceIqr: [quantile(absoluteDifferences, 0.25), quantile(absoluteDifferences, 0.75)],
      descriptiveBlandAltman: {
        differenceSd,
        lowerLimitOfAgreement: meanDifference - 1.96 * differenceSd,
        upperLimitOfAgreement: meanDifference + 1.96 * differenceSd,
        note: 'Descriptive summary of paired deterministic scores; not a clinical interchangeability test.',
      },
      scoreDependentDifferenceDiagnostics: {
        pearsonDifferenceVsPairwiseMean: pearson(differences, pairwiseMeans),
        pearsonAbsoluteDifferenceVsPairwiseMean: pearson(absoluteDifferences, pairwiseMeans),
        spearmanAbsoluteDifferenceVsPairwiseMean: pearson(rank(absoluteDifferences), rank(pairwiseMeans)),
        bins,
        interpretation: 'Differences are more negative at lower score means and their spread varies across the score range; constant limits should be interpreted cautiously.',
      },
    },
    madRulePathAudit: {
      referencePositiveMedWearNegative: madFalseNegatives.length,
      stoppedByMinimumHrBaselineGate: stoppedByMinimumBaseline.length,
      stoppedByMinimumHrBaselineGateProportion: stoppedByMinimumBaseline.length / madFalseNegatives.length,
      passedMinimumHrBaselineGate: passedMinimumBaseline.length,
      referenceMechanismsAmongGatePassersNonExclusive: countBy(passedMechanisms),
      referenceMechanismsAmongAllFalseNegativesNonExclusive: countBy(allMechanisms),
      note: 'Mechanism counts are non-exclusive because one case can trigger multiple independent-reference rules.',
    },
  };

  return payload;
}

if (require.main === module) {
  const output = parseOut();
  const payload = run();
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Frozen manuscript secondary analyses → ${output}`);
}

module.exports = { run };
