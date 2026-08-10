/**
 * Physiological data validation & artifact cleaning (Zod schemas).
 * Used before feature extraction and ONNX inference.
 */
const { z } = require('zod');

const PHYSIO_LIMITS = {
  hrMin: 30,
  hrMax: 220,
  spo2Min: 50,
  spo2Max: 100,
  hrvMin: 5,
  hrvMax: 250,
  respiratoryMin: 4,
  respiratoryMax: 60,
  stepsMax: 100000,
  energyMax: 10000,
};

const AppleHealthRecordSchema = z.object({
  type: z.string(),
  value: z.union([z.number(), z.string()]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  sourceName: z.string().optional(),
  sourceVersion: z.string().optional(),
  device: z.string().optional(),
});

const DayDataSchema = z.object({
  steps: z.number().nonnegative().max(PHYSIO_LIMITS.stepsMax).default(0),
  activeEnergy: z.number().nonnegative().max(PHYSIO_LIMITS.energyMax).default(0),
  distance: z.number().nonnegative().default(0),
  heartRate: z.array(z.number()).default([]),
  restingHeartRate: z.number().nullable().optional(),
  spo2: z.array(z.number()).default([]),
  hrv: z.array(z.number()).default([]),
  respiratoryRate: z.array(z.number()).default([]),
  sleepMinutes: z.object({
    deep: z.number().nonnegative().default(0),
    rem: z.number().nonnegative().default(0),
    light: z.number().nonnegative().default(0),
    awake: z.number().nonnegative().default(0),
    inBed: z.number().nonnegative().default(0),
  }).default({}),
  exerciseMinutes: z.number().nonnegative().optional(),
});

const FeatureVectorSchema = z.object({
  steps_norm: z.number().min(0).max(2),
  avg_hr: z.number().min(0).max(PHYSIO_LIMITS.hrMax),
  std_hr: z.number().min(0).max(100),
  resting_hr: z.number().min(0).max(PHYSIO_LIMITS.hrMax),
  avg_spo2: z.number().min(PHYSIO_LIMITS.spo2Min).max(PHYSIO_LIMITS.spo2Max),
  min_spo2: z.number().min(PHYSIO_LIMITS.spo2Min).max(PHYSIO_LIMITS.spo2Max),
  avg_hrv: z.number().min(0).max(PHYSIO_LIMITS.hrvMax),
  sleep_hours: z.number().min(0).max(24),
  deep_sleep_ratio: z.number().min(0).max(1),
  active_energy_norm: z.number().min(0).max(2),
  hr_above_threshold: z.union([z.literal(0), z.literal(1)]),
  spo2_below_threshold: z.union([z.literal(0), z.literal(1)]),
  low_activity: z.union([z.literal(0), z.literal(1)]),
  window_hr_mean: z.number().min(0).max(PHYSIO_LIMITS.hrMax),
  window_hr_std: z.number().min(0).max(100),
  anomaly_flag: z.union([z.literal(0), z.literal(1)]),
  health_score_norm: z.number().min(0).max(1),
});

function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Replace physiologically implausible readings via median imputation.
 * SpO₂ < 50% or HR > 220 bpm are treated as motion/ sensor artifacts.
 */
function cleanReadingSeries(values, { min, max, label }) {
  const clean = [];
  const artifacts = [];
  const valid = values.filter((v) => v >= min && v <= max);
  const fallback = valid.length ? median(valid) : (min + max) / 2;

  values.forEach((v, i) => {
    if (v < min || v > max) {
      artifacts.push({ index: i, value: v, label, replacedWith: fallback });
      clean.push(fallback);
    } else {
      clean.push(v);
    }
  });

  return { clean, artifacts, imputationRate: artifacts.length / Math.max(1, values.length) };
}

function cleanHeartRate(values) {
  return cleanReadingSeries(values, {
    min: PHYSIO_LIMITS.hrMin,
    max: PHYSIO_LIMITS.hrMax,
    label: 'heartRate',
  });
}

function cleanSpo2(values) {
  const normalized = values.map((v) => (v <= 1 ? v * 100 : v));
  return cleanReadingSeries(normalized, {
    min: PHYSIO_LIMITS.spo2Min,
    max: PHYSIO_LIMITS.spo2Max,
    label: 'spo2',
  });
}

function cleanHrv(values) {
  return cleanReadingSeries(values, {
    min: PHYSIO_LIMITS.hrvMin,
    max: PHYSIO_LIMITS.hrvMax,
    label: 'hrv',
  });
}

function cleanDayData(raw = {}) {
  const hr = cleanHeartRate(raw.heartRate || []);
  const spo2 = cleanSpo2(raw.spo2 || []);
  const hrv = cleanHrv(raw.hrv || []);

  let restingHR = raw.restingHeartRate;
  if (restingHR != null && (restingHR < PHYSIO_LIMITS.hrMin || restingHR > PHYSIO_LIMITS.hrMax)) {
    restingHR = median(hr.clean) ?? 70;
  }

  const cleaned = {
    ...raw,
    heartRate: hr.clean,
    spo2: spo2.clean,
    hrv: hrv.clean,
    restingHeartRate: restingHR,
  };

  const parsed = DayDataSchema.safeParse(cleaned);
  return {
    day: parsed.success ? parsed.data : DayDataSchema.parse({}),
    cleaningReport: {
      heartRate: { artifacts: hr.artifacts.length, imputationRate: hr.imputationRate },
      spo2: { artifacts: spo2.artifacts.length, imputationRate: spo2.imputationRate },
      hrv: { artifacts: hrv.artifacts.length, imputationRate: hrv.imputationRate },
    },
  };
}

function validateFeatureVector(features) {
  return FeatureVectorSchema.parse(features);
}

module.exports = {
  PHYSIO_LIMITS,
  AppleHealthRecordSchema,
  DayDataSchema,
  FeatureVectorSchema,
  cleanDayData,
  cleanHeartRate,
  cleanSpo2,
  cleanHrv,
  validateFeatureVector,
};
