/**
 * Unified patient registry — derives patient-management records from the
 * screening-outcome cohort so Patient Management and Outcomes Comparison
 * always reference the same physiologically realistic synthetic population.
 */

'use strict';

const { getCohort } = require('./outcomeModel');
const { uniqueNameFromId } = require('../data/patientIdentity');
const { assignDeviceStack } = require('../data/deviceIntegration');

function hashId(id) {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return h;
}

function nameFromId(id, sex) {
  return uniqueNameFromId(id, sex);
}

function maskPhone(id) {
  const h = hashId(id);
  const prefix = `1${3 + (h % 7)}${8 + (h % 2)}`;
  const tail = String(1000 + (h % 9000)).slice(-4);
  return `${prefix}****${tail}`;
}

function lastActiveFromId(id) {
  const h = hashId(id);
  const hours = 6 + (h % 14);
  const mins = (h >>> 4) % 60;
  if (h % 5 === 0) return `昨天 ${18 + (h % 4)}:${String(mins).padStart(2, '0')}`;
  return `今天 ${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function riskLevelFromTier(tier) {
  if (tier === 'high') return 'high';
  if (tier === 'moderate') return 'medium';
  return 'low';
}

function computeHealthScore(signals, riskScore) {
  const base = Math.round((1 - riskScore) * 52 + 38);
  const hrBonus = signals.restingHR >= 50 && signals.restingHR <= 75 ? 6 : 0;
  const spo2Bonus = signals.spo2 >= 96 ? 5 : 0;
  const stepsBonus = signals.steps >= 6000 ? 4 : 0;
  return Math.min(99, Math.max(38, base + hrBonus + spo2Bonus + stepsBonus));
}

function conditionsFromPatient(p) {
  if (p.category === 'healthy') return [];
  return [p.categoryLabel];
}

function toPatientRecord(p) {
  const gender = p.sex === 'F' ? '女' : '男';
  const deviceStack = assignDeviceStack(p.id);
  return {
    id: p.id,
    name: uniqueNameFromId(p.id, p.sex),
    gender,
    gender_en: p.sex === 'F' ? 'Female' : 'Male',
    age: p.age,
    phone: maskPhone(p.id),
    riskLevel: riskLevelFromTier(p.riskTier),
    riskTier: p.riskTier,
    riskScore: p.riskScore,
    healthScore: computeHealthScore(p.signals, p.riskScore),
    conditions: conditionsFromPatient(p),
    conditions_en: p.category === 'healthy' ? [] : [p.categoryLabel_en],
    devices: deviceStack.deviceCount,
    deviceList: deviceStack.devices,
    deviceIntegration: {
      devices: deviceStack.devices,
      deviceCount: deviceStack.deviceCount,
      primaryDevice: deviceStack.primaryDevice,
      primaryDevice_en: deviceStack.primaryDevice_en,
      fusionMode: deviceStack.fusionMode,
      fusionLabel: deviceStack.fusionLabel,
      fusionLabel_en: deviceStack.fusionLabel_en,
      fusionAccuracy: deviceStack.fusionAccuracy,
      singleDeviceAccuracy: deviceStack.singleDeviceAccuracy,
      fusedQuality: deviceStack.fusedQuality,
      singleQuality: deviceStack.singleQuality,
      accuracyGain: deviceStack.accuracyGain,
      fusionSources: deviceStack.fusionSources,
    },
    lastActive: lastActiveFromId(p.id),
    arm: p.arm,
    category: p.category,
    categoryLabel: p.categoryLabel,
    categoryLabel_en: p.categoryLabel_en,
    malignant: p.malignant,
    chronic: p.chronic,
    smoker: p.smoker,
    signals: p.signals,
    screened: p.screened,
    diagnosed: p.diagnosed,
    stageAtDiagnosis: p.stageAtDiagnosis,
    treatmentStarted: p.treatmentStarted,
    survival5yProb: p.survival5yProb,
    survived5y: p.survived5y,
    controlled: p.controlled,
  };
}

function getPatientRecords(opts) {
  const { patients } = getCohort(opts);
  return patients.map(toPatientRecord);
}

function filterPatients(records, { arm, riskTier, category, q, limit = 500, offset = 0 } = {}) {
  let list = records || getPatientRecords();
  if (arm === 'intervention' || arm === 'usual_care') {
    list = list.filter((p) => p.arm === arm);
  }
  if (riskTier) {
    list = list.filter((p) => p.riskTier === riskTier);
  }
  if (category) {
    list = list.filter((p) => p.category === category);
  }
  if (q) {
    const needle = String(q).toLowerCase();
    list = list.filter((p) =>
      p.id.toLowerCase().includes(needle)
      || p.name.includes(needle)
      || p.categoryLabel.includes(needle)
      || (p.deviceIntegration?.primaryDevice || '').includes(needle));
  }
  const total = list.length;
  const slice = list.slice(offset, offset + limit);
  return { total, patients: slice };
}

function getAdminOverview(opts) {
  const records = getPatientRecords(opts);
  const { meta } = getCohort(opts);
  return {
    patientCount: meta.n,
    highRiskCount: records.filter((p) => p.riskLevel === 'high').length,
    interventionCount: records.filter((p) => p.arm === 'intervention').length,
    controlCount: records.filter((p) => p.arm === 'usual_care').length,
    activeDevices: records.reduce((sum, p) => sum + p.devices, 0),
    pendingAlerts: records.filter((p) => p.riskTier !== 'low' && p.arm === 'intervention').length,
    cohortSeed: meta.seed,
  };
}

module.exports = {
  toPatientRecord,
  getPatientRecords,
  filterPatients,
  getAdminOverview,
  computeHealthScore,
  nameFromId,
};
