const {
  resolveDemoPatientId,
  getDemoPatientData,
  addDemoAppointment,
  getLiveVitalsFor,
  buildDoctorReportFor,
  listDemoPatients,
} = require('../mock/demoPatientRegistry');
const { enrichScreeningData } = require('../ai/engine');
const {
  getAllAnalytics,
  getEmptyAnalytics,
  buildRealScreening,
  buildRealDoctorReport,
} = require('../health/analytics');
const { hasData, getStore } = require('../health/store');
const { STANDARDS } = require('../mock/clinicalData');
const { getExamSlots } = require('../mock/clinicalData');

const REAL_APPT_FILE = require('path').join(__dirname, '../../data/real-appointments.json');
const fs = require('fs');
const path = require('path');

const REAL_EXAM_PACKAGES = [
  { id: 'real-tumor', name: 'Apple Health 肿瘤早筛', category: 'tumor', price: 2680, duration: '半天', includesWearableReport: true, items: ['低剂量 CT', '肿瘤标志物', '甲状腺 B 超', 'MedWear 真实数据报告'] },
  { id: 'real-cancer', name: '癌症专项筛查', category: 'cancer', price: 3280, duration: '1天', includesWearableReport: true, items: ['HPV/TCT', '胃镜', '肠镜', 'AFP/PSA', '数据融合解读'] },
  { id: 'real-chronic', name: '慢病筛查套餐', category: 'chronic', price: 1280, duration: '2h', includesWearableReport: true, items: ['动态血压', '血糖+HbA1c', '血脂', '心电图'] },
  { id: 'real-common', name: '常见小病 · 呼吸套餐', category: 'common', price: 680, duration: '1.5h', includesWearableReport: true, items: ['血常规', 'CRP', '胸片', '流感抗原', '过敏原检测'] },
  { id: 'real-resp', name: '呼吸系统专项', category: 'respiratory', price: 980, duration: '2h', includesWearableReport: true, items: ['肺功能', 'FeNO', '胸部 CT'] },
  { id: 'real-full', name: 'MedWear 真实数据全检', category: 'full', price: 3580, duration: '1天', includesWearableReport: true, items: ['全项基础检查', '真实 wearable 报告', '医生问诊 15 分钟'], highlight: true },
];

function loadRealAppointments() {
  try {
    if (fs.existsSync(REAL_APPT_FILE)) return JSON.parse(fs.readFileSync(REAL_APPT_FILE, 'utf8'));
  } catch { /* ignore */ }
  return [];
}

function saveRealAppointments(list) {
  const dir = path.dirname(REAL_APPT_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(REAL_APPT_FILE, JSON.stringify(list, null, 2));
}

function realAnalytics() {
  return hasData() ? getAllAnalytics() : getEmptyAnalytics();
}

function buildRealHealthContext() {
  const a = realAnalytics();
  if (!a.hasData) {
    return { mode: 'real', hasData: false, aiSummary: '请先导入 Apple Health 数据' };
  }
  const stats = a.dashboard.stats;
  return {
    mode: 'real',
    hasData: true,
    userLabel: a.meta?.userLabel,
    dateRange: a.meta?.dateRange,
    dayCount: a.meta?.dayCount,
    primarySource: a.meta?.sourceList?.[0]?.name || 'Apple Health',
    healthScore: stats.healthScore,
    heartRate: stats.heartRate,
    spo2: stats.spo2,
    hrv: stats.hrv,
    steps: stats.steps,
    sleepHours: stats.sleepHours,
    aiSummary: a.aiSummary,
    alerts: a.alerts?.slice(0, 3) || [],
  };
}

function createDemoProvider(req) {
  const pid = () => resolveDemoPatientId(req);
  const data = () => getDemoPatientData(pid());

  return {
    mode: 'demo',
    getPatientId: () => pid(),
    getProfile: () => ({ ...data().profile, dataMode: 'demo', dataImported: true, hasData: true }),
    getStandards: () => STANDARDS,
    getDashboardStats: () => ({ ...data().dashboard.stats, dataMode: 'demo', hasData: true, patientId: pid() }),
    getVitalsTrend: () => data().dashboard.vitalsTrend,
    getWeekTrend: () => data().dashboard.weekTrend,
    getHeartRateZones: () => data().dashboard.heartRateZones,
    getHealthScoreTrend: () => data().dashboard.healthScoreTrend,
    getOrganScores: () => data().dashboard.organScores,
    getAiInsights: () => data().dashboard.aiInsights,
    getRecentAlerts: () => data().dashboard.recentAlerts,
    getVitals: () => getLiveVitalsFor(data()),
    getDevices: () => data().devices,
    getAlerts: () => data().alerts,
    getAnomalies: () => data().anomalies,
    getPredictions: () => data().predictions,
    getSleep: () => ({ ...data().sleep, dataMode: 'demo' }),
    getRecovery: () => ({ ...data().recovery, dataMode: 'demo' }),
    getDigitalTwin: () => ({ ...data().digitalTwin, dataMode: 'demo' }),
    getFusionSources: () => data().fusionSources,
    getHealthGoals: () => data().healthGoals,
    getAiReport: () => ({ ...data().aiReport, dataMode: 'demo' }),
    getScreening: () => enrichScreeningData({ ...data().diseaseScreening, dataMode: 'demo', patientId: pid() }),
    getHospitals: () => data().hospitals,
    getExamPackages: () => data().examPackages,
    getAppointments: () => data().appointments,
    addAppointment: (appt) => addDemoAppointment(pid(), appt),
    getDoctorReport: () => buildDoctorReportFor(data()),
    getHealthContext: () => {
      const d = data();
      const s = d.dashboard.stats;
      return {
        mode: 'demo',
        hasData: true,
        patientId: pid(),
        patientName: d.profile.name,
        aiSummary: d.diseaseScreening.summary,
        healthScore: s.healthScore,
        heartRate: s.heartRate,
        spo2: s.spo2,
        hrv: s.hrv,
        steps: s.steps,
        sleepHours: s.sleepHours,
        summary: {
          patient: d.profile.name,
          age: d.profile.age,
          scenario: d.profile.scenario,
          overallRisk: d.diseaseScreening.overallRisk,
          overallScore: d.diseaseScreening.overallScore,
        },
      };
    },
    getRawDemoData: () => data(),
  };
}

const realProvider = {
  mode: 'real',
  getProfile: () => {
    if (!hasData()) {
      return {
        name: 'Apple Health 用户',
        age: null,
        gender: '—',
        device: '待导入',
        dataMode: 'real',
        dataImported: false,
        hasData: false,
      };
    }
    const store = getStore();
    const a = realAnalytics();
    return {
      name: store.meta?.userLabel || 'Apple Health 用户',
      age: null,
      gender: '—',
      device: a.devices[0]?.name || 'Apple Watch',
      dataMode: 'real',
      dataImported: true,
      hasData: true,
      dayCount: store.meta?.dayCount,
      dateRange: store.meta?.dateRange,
    };
  },
  getStandards: () => STANDARDS,
  getDashboardStats: () => realAnalytics().dashboard.stats,
  getVitalsTrend: () => realAnalytics().dashboard.vitalsTrend,
  getWeekTrend: () => realAnalytics().dashboard.weekTrend,
  getHeartRateZones: () => realAnalytics().dashboard.deviceDistribution,
  getHealthScoreTrend: () => realAnalytics().dashboard.healthScoreTrend,
  getOrganScores: () => realAnalytics().dashboard.organScores,
  getAiInsights: () => {
    const a = realAnalytics();
    if (!a.hasData) {
      return [{ type: 'warning', text: '真实模式：请先导入 Apple Health 数据，此处不会显示任何模拟数据。' }];
    }
    return [{ type: 'info', text: a.aiSummary }];
  },
  getRecentAlerts: () => realAnalytics().dashboard.recentAlerts,
  getVitals: () => ({ ...realAnalytics().vitals, hasData: realAnalytics().hasData }),
  getDevices: () => realAnalytics().devices,
  getAlerts: () => realAnalytics().alerts,
  getAnomalies: () => realAnalytics().anomalies,
  getPredictions: () => realAnalytics().predictions,
  getSleep: () => realAnalytics().sleep || getEmptyAnalytics().sleep,
  getRecovery: () => realAnalytics().recovery,
  getDigitalTwin: () => realAnalytics().digitalTwin,
  getFusionSources: () => realAnalytics().fusionSources,
  getHealthGoals: () => realAnalytics().healthGoals,
  getAiReport: () => realAnalytics().aiReport,
  getScreening: () => (hasData() ? buildRealScreening(getStore()) : buildRealScreening(null)),
  getHospitals: () => [],
  getExamPackages: () => REAL_EXAM_PACKAGES,
  getAppointments: () => loadRealAppointments(),
  addAppointment: (appt) => {
    const list = loadRealAppointments();
    list.unshift(appt);
    saveRealAppointments(list);
  },
  getDoctorReport: () => (hasData() ? buildRealDoctorReport(getStore()) : { hasData: false, needsImport: true, mode: 'real' }),
  getHealthContext: () => buildRealHealthContext(),
};

function getProvider(mode, req) {
  if (mode === 'real') return realProvider;
  return createDemoProvider(req);
}

module.exports = {
  getProvider,
  createDemoProvider,
  realProvider,
  loadRealAppointments,
  saveRealAppointments,
  buildRealHealthContext,
  REAL_EXAM_PACKAGES,
  getExamSlots,
  listDemoPatients,
  resolveDemoPatientId,
  getDemoPatientData,
};
