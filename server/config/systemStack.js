'use strict';

const fs = require('fs');
const path = require('path');
const { dbPath } = require('../health/db');
const { MODELS_DIR, DEFAULT_MODEL } = require('../ai/onnxInference');
const { PHYSIO_LIMITS } = require('../services/physioValidation');
const { SENSITIVITY_PRESETS } = require('../services/robustAnomaly');
const { BATCH_SIZE } = require('../health/parser');

function listOnnxModels() {
  if (!fs.existsSync(MODELS_DIR)) return [];
  return fs.readdirSync(MODELS_DIR).filter((f) => f.endsWith('.onnx')).map((f) => f.replace('.onnx', ''));
}

function getDefaultModelMeta() {
  const models = listOnnxModels();
  const id = models.includes(DEFAULT_MODEL) ? DEFAULT_MODEL : models[0];
  if (!id) return null;
  const metaPath = path.join(MODELS_DIR, `${id}.meta.json`);
  if (!fs.existsSync(metaPath)) return { modelId: id, available: true };
  try {
    return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  } catch {
    return { modelId: id, available: true };
  }
}

function getSystemStack() {
  const onnxModels = listOnnxModels();
  const modelMeta = getDefaultModelMeta();
  return {
    version: '2.0.0',
    stackLabel: 'MedWear Research Stack v2',
    inference: {
      engine: 'onnxruntime-node',
      training: 'experiments/medwear/train.py → skl2onnx',
      modelId: modelMeta?.model_id || (onnxModels[0] ?? null),
      modelType: modelMeta?.model_type || null,
      modelsAvailable: onnxModels,
      labelClasses: modelMeta?.label_classes || [],
      metrics: modelMeta?.metrics || null,
      featureDim: 17,
    },
    storage: {
      engine: 'better-sqlite3',
      database: dbPath(),
      legacyJson: 'health-store.json (auto-migrated)',
      batchImportSize: BATCH_SIZE,
      walMode: true,
    },
    analytics: {
      behavioralScore: 'BHI (behavioral-health-index)',
      anomalyDetection: 'robust-mad-zscore',
      zThreshold: SENSITIVITY_PRESETS.default.hrMadK,
      windowDays: SENSITIVITY_PRESETS.default.windowDays,
      activityFilterSteps: SENSITIVITY_PRESETS.default.activityStepsThreshold,
    },
    validation: {
      library: 'zod',
      module: 'server/services/physioValidation.js',
      artifactCleaning: true,
      limits: {
        spo2MinPercent: PHYSIO_LIMITS.spo2Min,
        hrMaxBpm: PHYSIO_LIMITS.hrMax,
      },
    },
  };
}

module.exports = { getSystemStack, listOnnxModels, getDefaultModelMeta };
