#!/usr/bin/env node
/**
 * Parameter sensitivity — perturb cohort simulation inputs and BHI thresholds.
 * Outcomes are highly parameter-driven (exploratory simulation only).
 */
const fs = require('fs');
const path = require('path');
const {
  getOutcomeSummary,
  STAGE_DISTRIBUTION,
  TREATMENT_INITIATION_RATE,
  CHRONIC_CONTROL_RATE,
  computeRiskScore,
} = require('../server/screening/outcomeModel');
const { classifyBHIWatchTier } = require('../server/config/bhiWatchTier');

const OUT = path.join(__dirname, '../benchmarks/results/sensitivity-outcomes-latest.json');
const DATASET = path.join(__dirname, '../benchmarks/wearable-analytics-dataset.json');

function baselineSurvivalDelta() {
  const s = getOutcomeSummary();
  return s.headline?.survival5y?.absoluteDelta ?? null;
}

function earlyStageFromDist(dist) {
  return +(dist.I + dist.II).toFixed(4);
}

function analyticalTornado(baseline) {
  const rows = [];

  const baseDist = STAGE_DISTRIBUTION.intervention;
  const baseEarly = earlyStageFromDist(baseDist);
  const perturbedEarly = earlyStageFromDist({ ...baseDist, I: Math.min(0.55, baseDist.I * 1.15), II: baseDist.II * 0.95 });
  rows.push({
    parameter: 'STAGE_DISTRIBUTION.intervention (I +15%)',
    metric: 'earlyStageRate (intervention, analytical)',
    baseline: baseEarly,
    perturbed: perturbedEarly,
    delta: +(perturbedEarly - baseEarly).toFixed(4),
  });

  const baseTreat = TREATMENT_INITIATION_RATE.intervention;
  const pertTreat = Math.min(0.99, baseTreat * 1.1);
  rows.push({
    parameter: 'TREATMENT_INITIATION_RATE.intervention (+10%)',
    metric: 'treatmentInitiationRate (intervention)',
    baseline: baseTreat,
    perturbed: +pertTreat.toFixed(4),
    delta: +(pertTreat - baseTreat).toFixed(4),
  });

  const baseChronic = CHRONIC_CONTROL_RATE.intervention;
  const pertChronic = Math.min(0.99, baseChronic * 1.08);
  rows.push({
    parameter: 'CHRONIC_CONTROL_RATE.intervention (+8%)',
    metric: 'chronicControlRate (intervention)',
    baseline: baseChronic,
    perturbed: +pertChronic.toFixed(4),
    delta: +(pertChronic - baseChronic).toFixed(4),
  });

  rows.push({
    parameter: 'simulated 5y survival headline (frozen cohort)',
    metric: 'survival5y.absoluteDelta',
    baseline: baseline,
    perturbed: baseline,
    delta: 0,
    note: 'Full cohort re-simulation requires regenerating cohort with patched constants — headline delta is parameter-encoded in outcomeModel presets',
  });

  return rows;
}

function bhiThresholdSensitivity() {
  if (!fs.existsSync(DATASET)) return null;
  const dataset = JSON.parse(fs.readFileSync(DATASET, 'utf8'));
  const scores = dataset.cases.map((c) => c.expected?.healthScore ?? c.expected?.bhi ?? null).filter((s) => s != null);
  if (!scores.length) return null;

  const tiersAt = (lo, hi) => scores.map((s) => {
    if (s >= hi) return 'low';
    if (s >= lo) return 'moderate';
    return 'high';
  });

  const defaultTiers = scores.map((s) => classifyBHIWatchTier(s));
  const strictTiers = tiersAt(65, 85);
  const lenientTiers = tiersAt(55, 75);

  const highRate = (tiers) => +(tiers.filter((t) => t === 'high').length / tiers.length).toFixed(4);
  return {
    n: scores.length,
    defaultHighRate: highRate(defaultTiers),
    strictHighRate: highRate(strictTiers),
    lenientHighRate: highRate(lenientTiers),
    note: 'BHI tier thresholds (80/60 default) shift watch-tier prevalence — not calibrated to clinical outcomes',
  };
}

function computeRiskScoreSensitivity() {
  const base = { restingHR: 78, hrv: 46, spo2: 97, steps: 7000, systolicBP: 120, fastingGlucose: 5.5, respRate: 16, skinTempDelta: 0.1 };
  const perturbed = { ...base, restingHR: 88, hrv: 38, spo2: 95.5, steps: 4500 };
  return {
    baseline: computeRiskScore(base),
    perturbed: computeRiskScore(perturbed),
    delta: +(computeRiskScore(perturbed) - computeRiskScore(base)).toFixed(4),
    note: 'computeRiskScore is a transparent wearable proxy — coefficients in outcomeModel.js',
  };
}

function main() {
  const baseline = baselineSurvivalDelta();
  const payload = {
    generatedAt: new Date().toISOString(),
    disclosure: 'Exploratory sensitivity — outcomes highly parameter-driven, no p-values, not prospective validation',
    baselineSurvival5yDelta: baseline,
    tornado: analyticalTornado(baseline),
    bhiThresholds: bhiThresholdSensitivity(),
    computeRiskScore: computeRiskScoreSensitivity(),
    regenerate: 'npm run sensitivity:outcomes',
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));
  console.log(`Sensitivity outcomes → ${OUT}`);
  console.log(`  Baseline 5y survival Δ: ${baseline}`);
}

main();
