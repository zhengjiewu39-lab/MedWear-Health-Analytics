import axios from 'axios';

/** Dev: CRA proxy → :3001; prod: set REACT_APP_API_BASE_URL or fall back to :3001 */
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL
  || (process.env.NODE_ENV === 'production' ? 'http://localhost:3001/api' : '/api');
const MODE_KEY = 'medwear_mode';
const DEMO_PATIENT_KEY = 'medwear_demo_patient';

const api = axios.create({ baseURL: API_BASE_URL, headers: { 'Content-Type': 'application/json' } });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.headers['X-MedWear-Mode'] = localStorage.getItem(MODE_KEY) || 'demo';
  if ((localStorage.getItem(MODE_KEY) || 'demo') === 'demo') {
    config.headers['X-MedWear-Demo-Patient'] = localStorage.getItem(DEMO_PATIENT_KEY) || 'IV-0001';
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (!error.response && error.code === 'ERR_NETWORK') {
      error.message = '无法连接 MedWear API（端口 3001）。请在项目目录运行 npm run dev 或 npm run server';
    }
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
  analyzeAnomaly: (data) => api.post('/ai/analyze-anomaly', data),
  getAnomalies: () => api.get('/anomalies'),
  getPredictions: () => api.get('/predictions'),
  getAnalysis: () => api.get('/ai/analysis'),
  getResearch: () => api.get('/ai/research'),
};

export const chatApi = {
  getStatus: () => api.get('/ai/chat/status'),
  getContext: () => api.get('/ai/chat/context'),
  send: (data) => api.post('/ai/chat', data),
};

export const interventionApi = {
  getSummary: () => api.get('/ai/interventions/summary'),
  getAll: (params) => api.get('/ai/interventions', { params }),
  generate: () => api.post('/ai/interventions/generate'),
  approve: (id, data) => api.post(`/ai/interventions/${id}/approve`, data),
  reject: (id, data) => api.post(`/ai/interventions/${id}/reject`, data),
};

export const settingsApi = {
  get: () => api.get('/settings'),
  saveAi: (data) => api.post('/settings/ai', data),
  getProviders: () => api.get('/settings').then((r) => r.data.aiProviders || []),
};

export const screeningApi = {
  getScreening: () => api.get('/screening'),
  getHospitals: () => api.get('/hospitals'),
  getExamPackages: () => api.get('/exam-packages'),
  getAppointments: () => api.get('/appointments'),
  getSlots: (date) => api.get('/appointments/slots', { params: { date } }),
  bookAppointment: (data) => api.post('/appointments', data),
  getDoctorReport: () => api.get('/doctor-report'),
  getDoctorReportProfile: () => api.get('/doctor-report/profile'),
  saveDoctorReportProfile: (data) => api.put('/doctor-report/profile', data),
  generateDoctorReport: (data) => api.post('/doctor-report/generate', data),
  exportDoctorReport: (format = 'json') => api.get('/doctor-report/export', {
    params: { format },
    responseType: format === 'html' ? 'blob' : 'json',
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
    return api.post('/data/import', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 600000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
  },
  scanFolder: () => api.post('/data/import/scan'),
  clearData: () => api.delete('/data/clear'),
};

export const modeApi = {
  get: () => api.get('/mode'),
};

export const demoApi = {
  listPatients: (params) => api.get('/demo/patients', { params }),
  getPatient: (id) => api.get(`/demo/patients/${id}`),
};

export const researchApi = {
  getDataset: () => api.get('/research/dataset'),
  getResults: () => api.get('/research/results'),
  runEvaluation: () => api.post('/research/evaluate'),
  runValidation: () => api.post('/research/validate'),
  getValidation: () => api.get('/research/validate'),
  getClinicalReferences: () => api.get('/research/references/clinical'),
  getMethods: () => api.get('/research/methods'),
  getReferences: () => api.get('/research/references'),
  analyze: (data) => api.post('/research/analyze', data),
};

export const patientApi = {
  getAll: (params) => api.get('/admin/patients', { params }),
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

export const methodologyApi = {
  get: () => api.get('/methodology'),
};

export const outcomesApi = {
  getSummary: () => api.get('/outcomes/summary'),
  getFunnel: () => api.get('/outcomes/funnel'),
  getSurvivalReference: () => api.get('/outcomes/survival-reference'),
  getCohort: (params) => api.get('/outcomes/cohort', { params }),
  getPatientComparison: () => api.get('/outcomes/patient-comparison'),
};

export default api;
