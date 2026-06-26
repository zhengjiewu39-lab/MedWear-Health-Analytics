const { mockData, buildDoctorReport } = require('../mock/clinicalData');
const { runFullAnalysis, enrichScreeningData } = require('../ai/engine');
const { anonymizeProfile } = require('../security/crypto');

const INTEGRATIONS = [
  {
    id: 'hospital-his',
    name: '医院 HIS 系统',
    type: 'outbound',
    protocol: 'HL7 FHIR R4',
    status: 'connected',
    endpoint: 'https://fhir.hospital-demo.cn/r4',
    lastSync: new Date().toISOString(),
    dataFlow: ['患者摘要', '筛查报告', '预约信息'],
  },
  {
    id: 'apple-health',
    name: 'Apple Health',
    type: 'inbound',
    protocol: 'HealthKit Export',
    status: 'connected',
    lastSync: new Date().toISOString(),
    dataFlow: ['心率', '血氧', '步数', '睡眠', 'ECG'],
  },
  {
    id: 'insurance',
    name: '商业保险核保',
    type: 'outbound',
    protocol: 'REST API + OAuth2',
    status: 'standby',
    dataFlow: ['脱敏筛查摘要'],
  },
  {
    id: 'research',
    name: '医学研究联盟',
    type: 'bidirectional',
    protocol: 'MedWear Open API v1',
    status: 'connected',
    dataFlow: ['匿名聚合统计'],
  },
];

const WEBHOOKS = [
  { id: 1, url: 'https://hospital-demo.cn/webhook/medwear', events: ['screening.alert', 'appointment.created'], active: true },
];

function getPlatformStatus() {
  return {
    version: 'MedWear Connect v1.0',
    status: 'online',
    integrations: INTEGRATIONS,
    webhooks: WEBHOOKS,
    openApi: '/api/platform/v1',
    uptime: process.uptime(),
  };
}

function platformVitals(anonymize = false) {
  const profile = anonymize ? anonymizeProfile(mockData.profile) : mockData.profile;
  return { profile, vitals: mockData.vitals, timestamp: new Date().toISOString() };
}

function platformScreening(anonymize = false) {
  const data = enrichScreeningData(mockData.diseaseScreening);
  if (anonymize) return { ...data, patient: anonymizeProfile(mockData.profile) };
  return data;
}

function platformReport(anonymize = false) {
  const report = buildDoctorReport();
  if (anonymize) report.patient = anonymizeProfile(report.patient);
  return report;
}

function platformAnalysis() {
  return runFullAnalysis();
}

module.exports = {
  INTEGRATIONS, WEBHOOKS, getPlatformStatus,
  platformVitals, platformScreening, platformReport, platformAnalysis,
};
