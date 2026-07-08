import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001/api';
const MODE_KEY = 'medwear_mode';

const api = axios.create({ baseURL: API_BASE_URL, headers: { 'Content-Type': 'application/json' } });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.headers['X-MedWear-Mode'] = localStorage.getItem(MODE_KEY) || 'demo';
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const isLogin = error.config?.url?.includes('/auth/login');
    if (error.response?.status === 401 && !isLogin) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (c) => api.post('/auth/login', c),
  logout: () => api.post('/auth/logout'),
  getCurrentUser: () => api.get('/auth/me'),
};

export const dashboardApi = {
  getStats: () => api.get('/dashboard/stats'),
  getVitalsTrend: () => api.get('/dashboard/vitals-trend'),
  getWeekTrend: () => api.get('/dashboard/week-trend'),
  getHeartRateZones: () => api.get('/dashboard/device-distribution'),
  getHealthScoreTrend: () => api.get('/dashboard/health-score-trend'),
  getOrganScores: () => api.get('/dashboard/organ-scores'),
  getAiInsights: () => api.get('/dashboard/ai-insights'),
  getRecentAlerts: () => api.get('/dashboard/recent-alerts'),
  getProfile: () => api.get('/profile'),
  getStandards: () => api.get('/standards'),
};

export const monitoringApi = { getVitals: () => api.get('/monitoring/vitals') };
export const deviceApi = { getAll: () => api.get('/devices') };
export const alertApi = { getAll: () => api.get('/alerts') };

export const aiApi = {
  chat: (data) => api.post('/ai/chat', data),
  analyzeAnomaly: (data) => api.post('/ai/analyze-anomaly', data),
  getReport: () => api.get('/ai/report'),
  getAnomalies: () => api.get('/anomalies'),
  getPredictions: () => api.get('/predictions'),
  getSleepData: () => api.get('/sleep'),
  getRecovery: () => api.get('/recovery'),
  getDigitalTwin: () => api.get('/digital-twin'),
  getFusionSources: () => api.get('/fusion/sources'),
  getHealthGoals: () => api.get('/health-goals'),
  getAnalysis: () => api.get('/ai/analysis'),
  getResearch: () => api.get('/ai/research'),
};

export const settingsApi = {
  get: () => api.get('/settings'),
  saveAi: (data) => api.post('/settings/ai', data),
};

export const screeningApi = {
  getScreening: () => api.get('/screening'),
  getHospitals: () => api.get('/hospitals'),
  getExamPackages: () => api.get('/exam-packages'),
  getAppointments: () => api.get('/appointments'),
  getSlots: (date) => api.get('/appointments/slots', { params: { date } }),
  bookAppointment: (data) => api.post('/appointments', data),
  getDoctorReport: () => api.get('/doctor-report'),
};

export const platformApi = {
  getStatus: () => api.get('/platform/status'),
  getApiKeys: () => api.get('/platform/api-keys'),
  testConnection: () => api.get('/platform/v1/analysis', {
    headers: { 'X-API-Key': 'mw_demo_hospital_001' },
  }),
};

export const securityApi = {
  getAuditLog: (limit) => api.get('/security/audit', { params: { limit } }),
  syncVault: () => api.post('/security/vault/sync'),
  getVaultStatus: () => api.get('/security/vault/status'),
  exportData: (anonymize = true) => api.get('/security/export', { params: { anonymize } }),
};

export const dataApi = {
  getStatus: () => api.get('/data/status'),
  getImportProgress: () => api.get('/data/import/progress'),
  importFile: (file) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/data/import', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  scanFolder: () => api.post('/data/import/scan'),
  clearData: () => api.delete('/data/clear'),
};

export const modeApi = {
  get: () => api.get('/mode'),
};

export const researchApi = {
  getDataset: () => api.get('/research/dataset'),
  getResults: () => api.get('/research/results'),
  runEvaluation: () => api.post('/research/evaluate'),
  getMethods: () => api.get('/research/methods'),
  getReferences: () => api.get('/research/references'),
  analyze: (data) => api.post('/research/analyze', data),
};

export const patientApi = {
  getAll: () => api.get('/admin/patients'),
};

export const organizationApi = {
  getDepartments: () => api.get('/admin/departments'),
  getStaff: () => api.get('/admin/staff'),
};

export const adminApi = {
  getOverview: () => api.get('/admin/overview'),
};

export const geoApi = {
  getLocation: () => api.get('/geo/location'),
};

export const publicHealthApi = {
  getMeta: () => api.get('/public-health/meta'),
  getSummary: (params) => api.get('/public-health/summary', { params }),
  getClusters: (params) => api.get('/public-health/clusters', { params }),
  getDailyReport: (params) => api.get('/public-health/daily-report', { params }),
  getInvestigation: (clusterId) => api.get(`/public-health/investigation/${clusterId}`),
  getEquityAnalysis: (params) => api.get('/public-health/equity-analysis', { params }),
  getEvaluation: () => api.get('/public-health/evaluation'),
  runEvaluation: (timeWindow = 72) => api.post('/public-health/evaluation/run', { timeWindow }),
  registerUser: (body) => api.post('/public-health/register-user', body),
};

export default api;
