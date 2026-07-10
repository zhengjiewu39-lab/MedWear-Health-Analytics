/**
 * Multi-device wearable integration — per-patient deterministic device stacks.
 * Fused signal quality exceeds any single device (addresses single-sensor accuracy drop).
 */

'use strict';

const WEARABLE_CATALOG = [
  {
    id: 'apple-watch-s9', name: 'Apple Watch Series 9', name_en: 'Apple Watch Series 9',
    type: 'smartwatch', vendor: 'Apple',
    metrics: ['心率', '血氧', 'HRV', '步数', '睡眠', 'ECG'],
    metrics_en: ['Heart rate', 'SpO₂', 'HRV', 'Steps', 'Sleep', 'ECG'],
    singleDeviceAccuracy: 0.91, quality: 96,
  },
  {
    id: 'garmin-fenix7', name: 'Garmin Fenix 7', name_en: 'Garmin Fenix 7',
    type: 'smartwatch', vendor: 'Garmin',
    metrics: ['心率', 'HRV', '步数', '睡眠', '压力'],
    metrics_en: ['Heart rate', 'HRV', 'Steps', 'Sleep', 'Stress'],
    singleDeviceAccuracy: 0.89, quality: 94,
  },
  {
    id: 'fitbit-sense2', name: 'Fitbit Sense 2', name_en: 'Fitbit Sense 2',
    type: 'smartwatch', vendor: 'Fitbit',
    metrics: ['心率', '血氧', 'HRV', '步数', '睡眠', '皮温'],
    metrics_en: ['Heart rate', 'SpO₂', 'HRV', 'Steps', 'Sleep', 'Skin temp'],
    singleDeviceAccuracy: 0.87, quality: 92,
  },
  {
    id: 'huawei-band8', name: 'Huawei Band 8', name_en: 'Huawei Band 8',
    type: 'band', vendor: 'Huawei',
    metrics: ['心率', '血氧', '步数', '睡眠'],
    metrics_en: ['Heart rate', 'SpO₂', 'Steps', 'Sleep'],
    singleDeviceAccuracy: 0.85, quality: 90,
  },
  {
    id: 'oura-gen3', name: 'Oura Ring Gen3', name_en: 'Oura Ring Gen3',
    type: 'ring', vendor: 'Oura',
    metrics: ['HRV', '睡眠', '体温', '活动'],
    metrics_en: ['HRV', 'Sleep', 'Temperature', 'Activity'],
    singleDeviceAccuracy: 0.90, quality: 95,
  },
  {
    id: 'withings-body', name: 'Withings Body+', name_en: 'Withings Body+',
    type: 'scale', vendor: 'Withings',
    metrics: ['体重', 'BMI', '体脂率'],
    metrics_en: ['Weight', 'BMI', 'Body fat %'],
    singleDeviceAccuracy: 0.93, quality: 97,
  },
  {
    id: 'iphone-15', name: 'iPhone 15 Pro', name_en: 'iPhone 15 Pro',
    type: 'phone', vendor: 'Apple',
    metrics: ['步数', '距离', '爬楼'],
    metrics_en: ['Steps', 'Distance', 'Floors climbed'],
    singleDeviceAccuracy: 0.82, quality: 88,
  },
  {
    id: 'samsung-watch6', name: 'Samsung Galaxy Watch6', name_en: 'Samsung Galaxy Watch6',
    type: 'smartwatch', vendor: 'Samsung',
    metrics: ['心率', '血氧', '步数', '睡眠'],
    metrics_en: ['Heart rate', 'SpO₂', 'Steps', 'Sleep'],
    singleDeviceAccuracy: 0.88, quality: 93,
  },
  {
    id: 'xiaomi-band8', name: 'Xiaomi Smart Band 8', name_en: 'Xiaomi Smart Band 8',
    type: 'band', vendor: 'Xiaomi',
    metrics: ['心率', '血氧', '步数', '睡眠'],
    metrics_en: ['Heart rate', 'SpO₂', 'Steps', 'Sleep'],
    singleDeviceAccuracy: 0.84, quality: 89,
  },
  {
    id: 'whoop-4', name: 'WHOOP 4.0', name_en: 'WHOOP 4.0',
    type: 'band', vendor: 'WHOOP',
    metrics: ['HRV', '睡眠', '恢复', '应变'],
    metrics_en: ['HRV', 'Sleep', 'Recovery', 'Strain'],
    singleDeviceAccuracy: 0.90, quality: 94,
  },
  {
    id: 'polar-vantage', name: 'Polar Vantage V3', name_en: 'Polar Vantage V3',
    type: 'smartwatch', vendor: 'Polar',
    metrics: ['心率', 'HRV', '步数', '训练负荷'],
    metrics_en: ['Heart rate', 'HRV', 'Steps', 'Training load'],
    singleDeviceAccuracy: 0.90, quality: 93,
  },
  {
    id: 'omron-bp', name: 'Omron 血压计 HEM-7361T', name_en: 'Omron HEM-7361T',
    type: 'bp_monitor', vendor: 'Omron',
    metrics: ['血压', '脉率'],
    metrics_en: ['Blood pressure', 'Pulse rate'],
    singleDeviceAccuracy: 0.95, quality: 98,
  },
];

const { patientIndexFromId } = require('./patientIdentity');

function hashId(id) {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return h;
}

function computeFusionAccuracy(devices) {
  if (!devices.length) return 0.85;
  if (devices.length === 1) return devices[0].singleDeviceAccuracy;
  const sorted = [...devices].sort((a, b) => b.singleDeviceAccuracy - a.singleDeviceAccuracy);
  let fused = sorted[0].singleDeviceAccuracy;
  for (let i = 1; i < sorted.length; i += 1) {
    const gain = (sorted[i].singleDeviceAccuracy * 0.35) * (1 - fused * 0.15);
    fused = Math.min(0.98, fused + gain);
  }
  const diversityBonus = Math.min(0.03, (devices.length - 1) * 0.008);
  return +Math.min(0.98, fused + diversityBonus).toFixed(3);
}

function normalizeWeights(devices) {
  const typeWeight = { smartwatch: 0.38, ring: 0.18, band: 0.14, scale: 0.12, phone: 0.10, bp_monitor: 0.08 };
  const raw = devices.map((d) => (typeWeight[d.type] || 0.1) * d.quality);
  const sum = raw.reduce((a, b) => a + b, 0);
  return devices.map((d, i) => +(raw[i] / sum).toFixed(3));
}

function seededShuffle(length, seed) {
  const order = Array.from({ length }, (_, i) => i);
  let s = seed >>> 0;
  for (let i = length - 1; i > 0; i -= 1) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

function assignDeviceStack(patientId) {
  const idx = patientIndexFromId(patientId);
  const h = hashId(patientId);
  const count = 2 + (idx % 3);
  const shuffle = seededShuffle(WEARABLE_CATALOG.length, idx * 2654435761 + h);
  const pickedIndices = shuffle.slice(0, count);

  let picked = pickedIndices.map((i) => ({ ...WEARABLE_CATALOG[i] }));

  if (!picked.some((d) => d.type === 'smartwatch' || d.type === 'band' || d.type === 'ring')) {
    const wearableIdx = shuffle.find((i) => {
      const t = WEARABLE_CATALOG[i].type;
      return t === 'smartwatch' || t === 'band' || t === 'ring';
    });
    if (wearableIdx != null) {
      picked[0] = { ...WEARABLE_CATALOG[wearableIdx] };
    }
  }

  const primaryOffset = idx % picked.length;
  if (primaryOffset > 0) {
    picked = [...picked.slice(primaryOffset), ...picked.slice(0, primaryOffset)];
  }

  const weights = normalizeWeights(picked);
  const fusionAccuracy = computeFusionAccuracy(picked);
  const primary = picked[0];
  const singleDeviceAccuracy = primary.singleDeviceAccuracy;
  const fusedQuality = Math.round(fusionAccuracy * 100);
  const singleQuality = Math.round(singleDeviceAccuracy * 100);

  const fusionSources = picked.map((d, i) => ({
    device: d.name,
    device_en: d.name_en,
    vendor: d.vendor,
    type: d.type,
    metrics: d.metrics,
    metrics_en: d.metrics_en,
    weight: weights[i],
    quality: d.quality,
    singleDeviceAccuracy: d.singleDeviceAccuracy,
  }));

  const devices = picked.map((d, i) => ({
    id: i + 1,
    deviceId: d.id,
    name: d.name,
    name_en: d.name_en,
    type: d.type,
    vendor: d.vendor,
    status: 'online',
    battery: 58 + ((h + i * 13) % 42),
    lastSync: i === 0 ? '刚刚' : `${5 + (h % 50) + i * 8} 分钟前`,
    metrics: d.metrics,
    metrics_en: d.metrics_en,
    weight: weights[i],
    quality: d.quality,
    singleDeviceAccuracy: Math.round(d.singleDeviceAccuracy * 100),
  }));

  return {
    devices,
    fusionSources,
    deviceCount: devices.length,
    primaryDevice: primary.name,
    primaryDevice_en: primary.name_en,
    fusionAccuracy,
    singleDeviceAccuracy,
    fusedQuality,
    singleQuality,
    accuracyGain: +(fusionAccuracy - singleDeviceAccuracy).toFixed(3),
    fusionMode: count >= 3 ? 'tri-source' : 'dual-source',
    fusionLabel: count >= 3 ? '三源融合' : '双源融合',
    fusionLabel_en: count >= 3 ? 'Tri-source fusion' : 'Dual-source fusion',
  };
}

function getCatalog() {
  return WEARABLE_CATALOG;
}

module.exports = {
  WEARABLE_CATALOG,
  assignDeviceStack,
  computeFusionAccuracy,
  getCatalog,
};
