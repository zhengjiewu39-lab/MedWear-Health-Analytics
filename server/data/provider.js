const fs = require('fs');
const path = require('path');
const {
  mockData, getLiveVitals, buildDoctorReport, getExamSlots,
} = require('../mock/clinicalData');
const { enrichScreeningData, enhancedChat } = require('../ai/engine');
const {
  getAllAnalytics,
  getEmptyAnalytics,
  buildRealScreening,
  buildRealDoctorReport,
} = require('../health/analytics');
const {
  buildRealScreeningCategories,
  buildRealTrendData,
  getRecommendedExams,
} = require('../data/screeningCatalog');
const { hasData, getStore } = require('../health/store');

const REAL_APPT_FILE = path.join(__dirname, '../../data/real-appointments.json');

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

const demoProvider = {
  mode: 'demo',
  getProfile: () => ({ ...mockData.profile, dataMode: 'demo', dataImported: true }),
  getStandards: () => mockData.standards,
  getDashboardStats: () => ({ ...mockData.dashboard.stats, dataMode: 'demo', hasData: true }),
  getVitalsTrend: () => mockData.dashboard.vitalsTrend,
  getWeekTrend: () => mockData.dashboard.weekTrend,
  getHeartRateZones: () => mockData.dashboard.heartRateZones,
  getHealthScoreTrend: () => mockData.dashboard.healthScoreTrend,
  getOrganScores: () => mockData.dashboard.organScores,
  getAiInsights: () => mockData.dashboard.aiInsights,
  getRecentAlerts: () => mockData.dashboard.recentAlerts,
  getVitals: () => getLiveVitals(),
  getDevices: () => mockData.devices,
  getAlerts: () => mockData.alerts,
  getAnomalies: () => mockData.anomalies,
  getPredictions: () => mockData.predictions,
  getSleep: () => ({ ...mockData.sleep, dataMode: 'demo' }),
  getRecovery: () => ({ ...mockData.recovery, dataMode: 'demo' }),
  getDigitalTwin: () => ({ ...mockData.digitalTwin, dataMode: 'demo' }),
  getFusionSources: () => mockData.fusionSources,
  getHealthGoals: () => mockData.healthGoals,
  getAiReport: () => ({ ...mockData.aiReport, dataMode: 'demo' }),
  getScreening: () => enrichScreeningData({ ...mockData.diseaseScreening, dataMode: 'demo' }),
  getHospitals: () => mockData.hospitals,
  getExamPackages: () => mockData.examPackages,
  getAppointments: () => mockData.appointments,
  addAppointment: (appt) => { mockData.appointments.unshift(appt); },
  getDoctorReport: () => ({ ...buildDoctorReport(), dataMode: 'demo' }),
  getHealthContext: () => ({
    mode: 'demo',
    hasData: true,
    aiSummary: mockData.diseaseScreening.summary,
    ...mockData.dashboard.stats,
  }),
  chat: (msg) => enhancedChat(msg),
};

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
  getStandards: () => mockData.standards,
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
  chat: () => ({
    reply: '真实模式请使用 OpenAI 大模型。请在设置中配置 API Key，并确保已导入 Apple Health 数据。',
    isSimulated: false,
    needsConfig: true,
    model: 'MedWear-AI · 真实模式',
  }),
};

function getProvider(mode) {
  return mode === 'real' ? realProvider : demoProvider;
}

module.exports = {
  getProvider,
  demoProvider,
  realProvider,
  loadRealAppointments,
  saveRealAppointments,
  buildRealHealthContext,
  REAL_EXAM_PACKAGES,
  getExamSlots,
};
