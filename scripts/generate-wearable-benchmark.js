#!/usr/bin/env node
/**
 * Expand MedWear-Wearable-Analytics benchmark for clinical performance estimation.
 *
 * Weighted-random phenotype synthesis with expert labels (independent of the rule engine).
 * Preserves hand-crafted WA-001…WA-008 seeds; remaining cases are randomly generated.
 *
 * Usage:
 *   node scripts/generate-wearable-benchmark.js [--n 5000] [--seed 42]
 *   node scripts/generate-wearable-benchmark.js --output benchmarks/wearable-analytics-dataset.json
 */

const fs = require('fs');
const path = require('path');
const { evaluateCase } = require('../server/services/analyticsCore');
const { adjudicateCase } = require('../server/services/clinicalGoldStandard');
const {
  buildClinicalRandomDays,
  enforceClinicalPlausibility,
  computeCohortClinicalStats,
} = require('../server/services/clinicalPhysiology');

const DEFAULT_OUT = path.join(__dirname, '../benchmarks/wearable-analytics-dataset.json');
const SEED_FILE = path.join(__dirname, '../benchmarks/wearable-analytics-seed-v1.json');
const THRESHOLDS = { heartRateMax: 100, heartRateMin: 50, spo2Min: 93 };

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { n: 5000, seed: 42, output: DEFAULT_OUT, days: 7 };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--n' || args[i] === '--cases') opts.n = Math.max(8, +args[++i]);
    else if (args[i] === '--seed') opts.seed = +args[++i];
    else if (args[i] === '--output' || args[i] === '--out') opts.output = args[++i];
    else if (args[i] === '--days') opts.days = Math.max(5, +args[++i]);
  }
  return opts;
}

function mulberry32(a) {
  return function rng() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function round(v, d = 0) { const f = 10 ** d; return Math.round(v * f) / f; }
function randInt(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }
function randArr(rng, n, lo, hi, d = 0) {
  return Array.from({ length: n }, () => round(lo + rng() * (hi - lo), d));
}

function sleepBlock(rng, deep, rem, light, awake) {
  return {
    deep: randInt(rng, Math.max(10, deep - 8), deep + 8),
    rem: randInt(rng, Math.max(10, rem - 8), rem + 8),
    light: randInt(rng, Math.max(120, light - 20), light + 20),
    awake: randInt(rng, Math.max(5, awake - 8), awake + 12),
  };
}

function dayRecord(rng, profile) {
  return enforceClinicalPlausibility({
    steps: randInt(rng, profile.steps[0], profile.steps[1]),
    heartRate: randArr(rng, profile.hrN || 4, profile.hr[0], profile.hr[1]),
    spo2: randArr(rng, profile.spo2N || 2, profile.spo2[0], profile.spo2[1], 1),
    hrv: randArr(rng, 2, profile.hrv[0], profile.hrv[1]),
    restingHeartRate: randInt(rng, profile.rhr[0], profile.rhr[1]),
    sleepMinutes: sleepBlock(rng, ...profile.sleep),
    activeEnergy: randInt(rng, profile.energy[0], profile.energy[1]),
  });
}

function buildDays(rng, days, baseline, targetOverride) {
  const start = new Date('2026-06-08');
  const daysMap = {};
  let targetKey = null;
  for (let i = 0; i < days; i++) {
    const dt = new Date(start);
    dt.setDate(start.getDate() + i);
    const key = dt.toISOString().slice(0, 10);
    const isTarget = i === days - 1;
    if (isTarget) targetKey = key;
    daysMap[key] = isTarget && targetOverride
      ? { ...dayRecord(rng, baseline), ...targetOverride(rng, baseline) }
      : dayRecord(rng, baseline);
  }
  return { days: daysMap, targetDay: targetKey };
}

/** Phenotype templates — expert labels are fixed, independent of rule engine output. */
const PHENOTYPES = [
  {
    key: 'healthy',
    label: 'Healthy baseline',
    weight: 0.22,
    expected: { alerts: [], anomaly: false, riskLevel: 'low', healthScoreMin: 75 },
    baseline: {
      steps: [7600, 8800], hr: [65, 73], spo2: [97, 98.5], hrv: [45, 56], rhr: [58, 66],
      sleep: [85, 100, 190, 18], energy: [380, 450],
    },
    target: null,
  },
  {
    key: 'tachycardia',
    label: 'Tachycardia alert',
    weight: 0.10,
    expected: { alerts: ['心率偏高'], anomaly: false, riskLevel: 'moderate', healthScoreMin: 50 },
    baseline: {
      steps: [5000, 6200], hr: [70, 78], spo2: [96, 97.5], hrv: [34, 42], rhr: [68, 74],
      sleep: [55, 70, 185, 35], energy: [280, 360],
    },
    target: (rng) => ({
      heartRate: randArr(rng, 4, 103, 115),
      restingHeartRate: randInt(rng, 85, 92),
      steps: randInt(rng, 4500, 5800),
    }),
  },
  {
    key: 'bradycardia',
    label: 'Bradycardia alert',
    weight: 0.08,
    expected: { alerts: ['心率偏低'], anomaly: false, riskLevel: 'moderate', healthScoreMin: 60 },
    baseline: {
      steps: [6500, 7400], hr: [54, 58], spo2: [97.5, 99], hrv: [52, 60], rhr: [52, 56],
      sleep: [95, 115, 180, 12], energy: [360, 400],
    },
    target: (rng) => ({
      heartRate: randArr(rng, 4, 40, 48),
      restingHeartRate: randInt(rng, 40, 46),
    }),
  },
  {
    key: 'hypoxemia',
    label: 'Hypoxemia alert',
    weight: 0.10,
    expected: { alerts: ['血氧偏低'], anomaly: true, riskLevel: 'high', healthScoreMin: 40 },
    baseline: {
      steps: [5800, 7200], hr: [72, 78], spo2: [94, 97], hrv: [34, 42], rhr: [70, 76],
      sleep: [60, 75, 205, 32], energy: [300, 360],
    },
    target: (rng) => ({
      spo2: randArr(rng, 3, 88, 92.5, 1),
      heartRate: randArr(rng, 3, 76, 82),
      steps: randInt(rng, 5200, 6200),
    }),
  },
  {
    key: 'sedentary',
    label: 'Sedentary alert',
    weight: 0.10,
    expected: { alerts: ['活动量不足'], anomaly: false, riskLevel: 'moderate', healthScoreMin: 55 },
    baseline: {
      steps: [7400, 8600], hr: [66, 72], spo2: [97, 98], hrv: [44, 52], rhr: [62, 68],
      sleep: [85, 98, 198, 18], energy: [370, 410],
    },
    target: (rng) => ({
      steps: randInt(rng, 1200, 2800),
      activeEnergy: randInt(rng, 100, 180),
    }),
  },
  {
    key: 'hr_spike',
    label: 'HR spike anomaly',
    weight: 0.08,
    expected: { alerts: [], anomaly: true, riskLevel: 'moderate', healthScoreMin: 60 },
    baseline: {
      steps: [6500, 7400], hr: [66, 72], hrN: 4, spo2: [97, 98], hrv: [44, 50], rhr: [65, 70],
      sleep: [82, 95, 198, 20], energy: [340, 380],
    },
    target: (rng) => ({
      heartRate: [
        70,
        72,
        randInt(rng, 125, 136),
        randInt(rng, 124, 134),
        randInt(rng, 126, 138),
        71,
        73,
      ],
      steps: randInt(rng, 6000, 7000),
    }),
  },
  {
    key: 'poor_sleep',
    label: 'Poor sleep high risk',
    weight: 0.06,
    expected: { alerts: ['活动量不足'], anomaly: true, riskLevel: 'high', healthScoreMin: 30 },
    baseline: {
      steps: [2800, 4200], hr: [78, 84], spo2: [93, 96], hrv: [20, 30], rhr: [76, 82],
      sleep: [15, 28, 155, 65], energy: [150, 210],
    },
    target: (rng) => ({
      steps: randInt(rng, 2200, 3200),
      sleepMinutes: sleepBlock(rng, 12, 22, 160, 72),
      hrv: randArr(rng, 2, 18, 24),
    }),
  },
  {
    key: 'multi_alert',
    label: 'Multi-alert compound',
    weight: 0.06,
    expected: { alerts: ['心率偏高', '血氧偏低', '活动量不足'], anomaly: true, riskLevel: 'high', healthScoreMin: 25 },
    baseline: {
      steps: [4400, 5800], hr: [74, 80], spo2: [92, 95], hrv: [28, 36], rhr: [72, 78],
      sleep: [40, 55, 200, 45], energy: [230, 300],
    },
    target: (rng) => ({
      steps: randInt(rng, 1800, 2600),
      heartRate: randArr(rng, 3, 108, 118),
      spo2: randArr(rng, 2, 86, 91, 1),
      restingHeartRate: randInt(rng, 88, 94),
      activeEnergy: randInt(rng, 110, 160),
    }),
  },
  {
    key: 'exercise_fp',
    label: 'Exercise-induced HR (product FP)',
    weight: 0.10,
    expected: { alerts: [], anomaly: false, riskLevel: 'low', healthScoreMin: 70 },
    baseline: {
      steps: [7200, 8400], hr: [68, 76], spo2: [97, 98.5], hrv: [46, 54], rhr: [58, 66],
      sleep: [88, 98, 195, 16], energy: [400, 480],
    },
    target: (rng) => ({
      steps: randInt(rng, 7800, 11200),
      restingHeartRate: randInt(rng, 58, 72),
      heartRate: [
        randInt(rng, 68, 74),
        randInt(rng, 70, 76),
        randInt(rng, 108, 128),
        randInt(rng, 105, 122),
        randInt(rng, 69, 75),
      ],
      activeEnergy: randInt(rng, 480, 620),
    }),
  },
  {
    key: 'spo2_artifact_fp',
    label: 'Single SpO₂ artifact (product FP)',
    weight: 0.06,
    expected: { alerts: [], anomaly: false, riskLevel: 'low', healthScoreMin: 72 },
    baseline: {
      steps: [6800, 8200], hr: [66, 74], spo2: [96.5, 98], hrv: [44, 52], rhr: [60, 68],
      sleep: [85, 95, 200, 18], energy: [360, 430],
    },
    target: (rng) => ({
      spo2: [97.2, 96.8, round(88 + rng() * 3, 1), 97.5],
      heartRate: randArr(rng, 4, 64, 74),
      steps: randInt(rng, 7000, 9000),
    }),
  },
  {
    key: 'recovery_rest_fp',
    label: 'Planned recovery day (product FP)',
    weight: 0.04,
    expected: { alerts: [], anomaly: false, riskLevel: 'low', healthScoreMin: 68 },
    baseline: {
      steps: [7600, 8800], hr: [64, 72], spo2: [97, 98], hrv: [48, 56], rhr: [58, 65],
      sleep: [90, 105, 205, 12], energy: [380, 450],
    },
    target: (rng) => ({
      steps: randInt(rng, 2500, 2950),
      sleepMinutes: sleepBlock(rng, 95, 110, 220, 10),
      heartRate: randArr(rng, 4, 58, 68),
      restingHeartRate: randInt(rng, 56, 64),
      activeEnergy: randInt(rng, 140, 220),
    }),
  },
];

function pickPhenotype(rng) {
  const r = rng();
  let acc = 0;
  for (const p of PHENOTYPES) {
    acc += p.weight;
    if (r <= acc) return p;
  }
  return PHENOTYPES[PHENOTYPES.length - 1];
}

function alertsEqual(a, b) {
  const sa = new Set(a || []);
  const sb = new Set(b || []);
  if (sa.size !== sb.size) return false;
  for (const x of sa) if (!sb.has(x)) return false;
  return true;
}

function buildRandomDays(rng, days) {
  const { days: daysMap, targetDay } = buildClinicalRandomDays(rng, days);
  return { days: daysMap, targetDay };
}

function labelCase(caseData, phenotypeKey) {
  const gold = adjudicateCase(caseData);
  return {
    ...caseData,
    expected: {
      alerts: gold.alerts,
      anomaly: gold.anomaly,
      riskLevel: gold.riskLevel,
      healthScoreMin: gold.healthScoreMin,
      healthScoreMax: gold.healthScoreMax,
      referenceScore: gold.referenceScore,
      adjudication: gold.adjudication,
    },
    _phenotype: phenotypeKey,
  };
}

function generateCase(id, phenotype, rng, days) {
  const { days: daysMap, targetDay } = buildDays(rng, days, phenotype.baseline, phenotype.target);
  return labelCase({
    id,
    label: phenotype.label,
    targetDay,
    days: daysMap,
  }, phenotype.key);
}

function generateUniformRandomCase(id, rng, days) {
  const { days: daysMap, targetDay } = buildRandomDays(rng, days);
  return labelCase({
    id,
    label: 'Clinical-random adult wearable profile',
    targetDay,
    days: daysMap,
  }, 'clinical_random');
}

function generateRandomBenchmark(targetN, seed, daysPerCase) {
  const rng = mulberry32(seed);
  const seeds = loadSeedCases();
  const cases = seeds.map((c) => labelCase({ ...c }, 'seed'));
  const counts = { seed: seeds.length };

  while (cases.length < targetN) {
    const id = `WA-${String(cases.length + 1).padStart(4, '0')}`;
    const useUniform = rng() < 0.28;
    if (useUniform) {
      cases.push(generateUniformRandomCase(id, rng, daysPerCase));
      counts.clinical_random = (counts.clinical_random || 0) + 1;
    } else {
      const phenotype = pickPhenotype(rng);
      cases.push(generateCase(id, phenotype, rng, daysPerCase));
      counts[phenotype.key] = (counts[phenotype.key] || 0) + 1;
    }
  }

  const distribution = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([phenotype, n]) => ({ phenotype, n, pct: +(n / cases.length).toFixed(3) }));

  return { cases, distribution };
}

function previewEngineAgreement(cases) {
  let alertMatch = 0;
  let anomalyMatch = 0;
  let riskMatch = 0;
  let scoreMatch = 0;
  cases.forEach((c) => {
    const pred = evaluateCase(c, THRESHOLDS);
    if (alertsEqual(pred.alerts, c.expected.alerts)) alertMatch += 1;
    if (pred.anomalyDetected === c.expected.anomaly) anomalyMatch += 1;
    if (pred.riskLevel === c.expected.riskLevel) riskMatch += 1;
    const ref = c.expected.referenceScore;
    if (pred.healthScore != null && ref != null && Math.abs(pred.healthScore - ref) <= 8) scoreMatch += 1;
  });
  const n = cases.length;
  return {
    alertExactMatchRate: +(alertMatch / n).toFixed(4),
    anomalyAccuracy: +(anomalyMatch / n).toFixed(4),
    riskAccuracy: +(riskMatch / n).toFixed(4),
    scoreAgreementRate: +(scoreMatch / n).toFixed(4),
  };
}

function loadSeedCases() {
  const p = fs.existsSync(SEED_FILE) ? SEED_FILE : DEFAULT_OUT;
  if (!fs.existsSync(p)) return [];
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  return (raw.cases || []).filter((c) => /^WA-00[1-8]$/.test(c.id));
}

function main() {
  const opts = parseArgs();
  const seedCases = loadSeedCases();
  if (seedCases.length !== 8) {
    console.error(`Expected 8 seed cases in ${SEED_FILE}, found ${seedCases.length}`);
    process.exit(1);
  }

  const { cases, distribution } = generateRandomBenchmark(opts.n, opts.seed, opts.days);
  const preview = previewEngineAgreement(cases);

  const clinicalCharacteristics = computeCohortClinicalStats(cases);

  const dataset = {
    dataset: 'MedWear-Wearable-Analytics-Clinical-v2',
    version: '2.5.0',
    license: 'CC-BY-4.0',
    description: 'Synthetic multi-day wearable cases. Physiology: 72% weighted-random phenotypes (incl. exercise/SpO₂ artifact/rest-day FP scenarios) + 28% clinically correlated random adults. Gold labels: contextual clinical adjudication (clinicalGoldStandard-v1), NOT the product analytics engine.',
    labelSource: 'clinical-gold-standard-v1',
    superseded: 'MedWear-Wearable-Analytics-Mini-v1',
    generatedAt: new Date().toISOString(),
    seed: opts.seed,
    rng: 'mulberry32',
    n: cases.length,
    daysPerCase: opts.days,
    expansionMethod: 'clinical-random-physiology-fp-adjudication',
    physiologyMix: { clinicalRandom: 0.28, phenotypeRandom: 0.72 },
    phenotypeDistribution: distribution,
    clinicalCharacteristics,
    thresholds: THRESHOLDS,
    cases: cases.map(({ _phenotype, ...rest }) => rest),
  };

  fs.mkdirSync(path.dirname(path.resolve(opts.output)), { recursive: true });
  fs.writeFileSync(opts.output, JSON.stringify(dataset, null, 2));

  console.log(`Generated ${cases.length} benchmark cases (seed=${opts.seed})`);
  console.log(`  Method: random physiology + independent clinical adjudication labels`);
  console.log(`  Phenotypes: ${distribution.map((d) => `${d.phenotype}=${d.n}`).join(', ')}`);
  console.log(`  Engine vs clinical gold (preview): alert=${(preview.alertExactMatchRate * 100).toFixed(1)}% anomaly=${(preview.anomalyAccuracy * 100).toFixed(1)}% risk=${(preview.riskAccuracy * 100).toFixed(1)}% score≈${(preview.scoreAgreementRate * 100).toFixed(1)}%`);
  console.log(`  → ${opts.output}`);
}

if (require.main === module) main();
module.exports = {
  PHENOTYPES, generateCase, generateUniformRandomCase, generateRandomBenchmark, labelCase, mulberry32, alertsEqual,
};
