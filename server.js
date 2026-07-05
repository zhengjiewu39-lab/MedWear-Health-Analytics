require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { getExamSlots } = require('./server/mock/clinicalData');
const { runFullAnalysis, getAllReferences } = require('./server/ai/engine');
const { chatWithLLM } = require('./server/ai/llm');
const { loadConfig, saveConfig, isAiConfigured } = require('./server/ai/config');
const { authenticate, verifyToken, authMiddleware, getApiKeys, ALLOW_DEMO } = require('./server/security/auth');
const { audit, auditMiddleware, getAuditLog } = require('./server/security/audit');
const { saveVault, loadVault, anonymizeProfile, ALGO } = require('./server/security/crypto');
const { getPlatformStatus, platformVitals, platformScreening, platformReport, platformAnalysis } = require('./server/platform/connect');
const { modeMiddleware, isRealMode } = require('./server/middleware/mode');
const { getProvider } = require('./server/data/provider');
const { registerDataRoutes } = require('./server/routes/data');
const { registerAdminRoutes } = require('./server/routes/admin');
const researchRoutes = require('./server/routes/research');
const { geolocate } = require('./server/geo/location');
const { findNearbyHospitals } = require('./server/geo/hospitals');
const { mockData } = require('./server/mock/clinicalData');

const app = express();
const port = process.env.PORT || 3001;

app.set('trust proxy', true);
app.use(helmet({ contentSecurityPolicy: false }));

const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : null;

app.use(cors({
  origin: corsOrigins || ((origin, callback) => {
    if (!origin || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
      return callback(null, true);
    }
    if (process.env.NODE_ENV !== 'production') return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  }),
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX || 300),
  standardHeaders: true,
  legacyHeaders: false,
}));
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { success: false, message: '登录尝试过于频繁，请稍后再试' },
});
app.use(modeMiddleware);
app.use(auditMiddleware);
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} [${req.dataMode}] ${req.method} ${req.url}`);
  next();
});
app.use(authMiddleware);

function resolveUser(req) {
  return req.user || verifyToken(req.headers.authorization);
}

function provider(req) {
  return getProvider(isRealMode(req) ? 'real' : 'demo');
}

// ── Auth ──
app.post('/api/auth/login', authLimiter, (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '').trim();
  const result = authenticate(username, password);
  if (!result) {
    audit('LOGIN_FAILED', { user: username, ip: req.ip, success: false });
    return res.status(401).json({ success: false, message: '用户名或密码错误' });
  }
  audit('LOGIN', { user: username, ip: req.ip, success: true });
  return res.json({ success: true, ...result });
});
app.post('/api/auth/logout', (req, res) => {
  audit('LOGOUT', { user: resolveUser(req)?.username, ip: req.ip });
  res.json({ success: true });
});
app.get('/api/auth/me', (req, res) => {
  const user = resolveUser(req);
  user ? res.json(user) : res.status(401).json({ success: false });
});

registerDataRoutes(app, resolveUser);
registerAdminRoutes(app);
app.use('/api/research', researchRoutes);

app.get('/api/health', (_, res) => {
  res.json({ status: 'ok', service: 'MedWear API', version: '1.0', modes: ['demo', 'real'] });
});

// ── Profile & Dashboard ──
app.get('/api/profile', (req, res) => res.json(provider(req).getProfile()));
app.get('/api/standards', (req, res) => res.json(provider(req).getStandards()));
app.get('/api/dashboard/stats', (req, res) => res.json(provider(req).getDashboardStats()));
app.get('/api/dashboard/vitals-trend', (req, res) => res.json(provider(req).getVitalsTrend()));
app.get('/api/dashboard/week-trend', (req, res) => res.json(provider(req).getWeekTrend()));
app.get('/api/dashboard/device-distribution', (req, res) => res.json(provider(req).getHeartRateZones()));
app.get('/api/dashboard/health-score-trend', (req, res) => res.json(provider(req).getHealthScoreTrend()));
app.get('/api/dashboard/organ-scores', (req, res) => res.json(provider(req).getOrganScores()));
app.get('/api/dashboard/ai-insights', (req, res) => res.json(provider(req).getAiInsights()));
app.get('/api/dashboard/recent-alerts', (req, res) => res.json(provider(req).getRecentAlerts()));

app.get('/api/monitoring/vitals', (req, res) => res.json(provider(req).getVitals()));
app.get('/api/devices', (req, res) => res.json(provider(req).getDevices()));
app.get('/api/alerts', (req, res) => res.json(provider(req).getAlerts()));

app.get('/api/anomalies', (req, res) => res.json(provider(req).getAnomalies()));
app.get('/api/predictions', (req, res) => res.json(provider(req).getPredictions()));
app.get('/api/sleep', (req, res) => res.json(provider(req).getSleep()));
app.get('/api/recovery', (req, res) => res.json(provider(req).getRecovery()));
app.get('/api/digital-twin', (req, res) => res.json(provider(req).getDigitalTwin()));
app.get('/api/fusion/sources', (req, res) => res.json(provider(req).getFusionSources()));
app.get('/api/health-goals', (req, res) => res.json(provider(req).getHealthGoals()));
app.get('/api/ai/report', (req, res) => res.json(provider(req).getAiReport()));
app.get('/api/ai/analysis', (req, res) => res.json(runFullAnalysis()));
app.get('/api/ai/research', (_, res) => res.json(getAllReferences()));

app.post('/api/ai/chat', async (req, res) => {
  const p = provider(req);
  const message = req.body.message || '';
  if (isRealMode(req)) {
    const result = await chatWithLLM(message, p.getHealthContext());
    return res.json(result);
  }
  const result = p.chat(message);
  return res.json({ ...result, isSimulated: true, model: 'MedWear-AI v3 (演示)' });
});

app.post('/api/ai/analyze-anomaly', async (req, res) => {
  const p = provider(req);
  const anomalies = p.getAnomalies();
  const a = anomalies[0];
  if (isRealMode(req)) {
    if (!a) {
      return res.json({
        analysis: '暂无异常数据。请先导入 Apple Health 数据，系统将基于真实记录检测异常。',
        confidence: 0,
        similarCases: 0,
        recommendation: '前往「数据导入」上传健康数据',
        citations: [],
        needsImport: true,
      });
    }
    if (isAiConfigured()) {
      const result = await chatWithLLM(`请深度分析以下异常并给出建议：${a.pattern}`, p.getHealthContext());
      return res.json({
        analysis: result.reply,
        confidence: a.confidence,
        similarCases: 0,
        recommendation: '请结合线下体检确认',
        citations: result.citations || [],
        isRealAi: true,
      });
    }
    return res.json({
      analysis: `【真实数据异常】${a.pattern}\n\n请配置 OpenAI API Key 以启用真实 AI 深度分析。`,
      confidence: a.confidence,
      similarCases: 0,
      recommendation: '继续监测，异常持续请咨询医生',
      citations: [],
      needsConfig: true,
    });
  }
  const demoA = a || mockData.anomalies[0];
  res.json({
    analysis: `【演示分析】${demoA.pattern}\n\n演示模式规则引擎分析。`,
    confidence: demoA.confidence,
    similarCases: 2,
    recommendation: '继续监测，异常持续请咨询医生',
    citations: [],
    isSimulated: true,
  });
});

// ── Geo & Hospitals ──
app.get('/api/geo/location', async (req, res) => {
  try {
    const location = await geolocate(req);
    res.json(location);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/hospitals', async (req, res) => {
  if (isRealMode(req)) {
    const location = await geolocate(req);
    const hospitals = findNearbyHospitals(location.lat, location.lng);
    return res.json({ mode: 'real', location, hospitals });
  }
  return res.json({
    mode: 'demo',
    location: { city: '北京', region: '北京', source: 'demo' },
    hospitals: provider(req).getHospitals(),
  });
});

// ── Screening & Appointments ──
app.get('/api/screening', (req, res) => res.json(provider(req).getScreening()));
app.get('/api/exam-packages', (req, res) => res.json(provider(req).getExamPackages()));
app.get('/api/appointments', (req, res) => res.json(provider(req).getAppointments()));
app.get('/api/appointments/slots', (req, res) => {
  res.json(getExamSlots(req.query.date || new Date().toISOString().slice(0, 10)));
});
app.post('/api/appointments', async (req, res) => {
  const p = provider(req);
  const { hospitalId, packageId, date, time } = req.body;
  let hospitals;
  if (isRealMode(req)) {
    const loc = await geolocate(req);
    hospitals = findNearbyHospitals(loc.lat, loc.lng);
  } else {
    hospitals = p.getHospitals();
  }
  const hospital = hospitals.find(h => h.id === hospitalId);
  const pkg = p.getExamPackages().find(x => x.id === packageId);
  if (!hospital || !pkg || !date || !time) {
    return res.status(400).json({ success: false, message: '请完整填写预约信息' });
  }
  const appointment = {
    id: Date.now(),
    hospitalId,
    hospitalName: hospital.name,
    hospitalDistance: hospital.distance,
    packageId,
    packageName: pkg.name,
    date,
    time,
    status: 'confirmed',
    mode: req.dataMode,
    doctorNote: pkg.includesWearableReport ? '请空腹，到院出示 MedWear 医生报告' : '请按套餐要求准备',
    includesWearableReport: pkg.includesWearableReport,
    createdAt: new Date().toISOString().slice(0, 10),
  };
  p.addAppointment(appointment);
  audit('APPOINTMENT_CREATE', { user: resolveUser(req)?.username, detail: `${req.dataMode}:${pkg.name}` });
  res.json({ success: true, appointment });
});
app.get('/api/doctor-report', (req, res) => res.json(provider(req).getDoctorReport()));

// ── Settings & AI Config ──
app.get('/api/settings', (req, res) => {
  const aiConfig = loadConfig();
  res.json({
    aiEnabled: true,
    aiModel: isRealMode(req) && aiConfig.apiKeySet ? aiConfig.model : 'MedWear-AI v3.0 Ensemble',
    confidenceThreshold: 85,
    aiModels: ['CardioNet-v3', 'VitalGuard-v2', 'OncoScreen-v1', 'GlucoPredict-v2', 'SleepAI-v2'],
    alertThresholds: { heartRateMax: 100, heartRateMin: 50, spo2Min: 95, glucoseMax: 11.1 },
    realtimeEnabled: true,
    autoSync: true,
    refreshInterval: 5,
    encryptionEnabled: true,
    encryptionAlgorithm: ALGO,
    auditLogEnabled: true,
    anonymizeExport: true,
    dataMode: req.dataMode,
    platformConnected: true,
    aiConfigured: aiConfig.apiKeySet,
    realAiAvailable: aiConfig.apiKeySet,
  });
});

app.post('/api/settings/ai', (req, res) => {
  const { apiKey, model, baseUrl } = req.body;
  const saved = saveConfig({ apiKey, model, baseUrl });
  res.json({ success: true, aiConfigured: saved.apiKeySet, model: saved.model });
});

app.get('/api/security/audit', (req, res) => res.json(getAuditLog(Number(req.query.limit) || 50)));
app.post('/api/security/vault/sync', (req, res) => {
  const p = provider(req);
  const snapshot = { profile: p.getProfile(), vitals: p.getVitals(), screening: p.getScreening(), syncedAt: new Date().toISOString(), mode: req.dataMode };
  const result = saveVault(snapshot);
  audit('VAULT_SYNC', { user: resolveUser(req)?.username, detail: req.dataMode });
  res.json({ success: true, ...result });
});
app.get('/api/security/vault/status', (_, res) => {
  const vault = loadVault();
  res.json({ encrypted: Boolean(vault), algorithm: ALGO, lastSync: vault?.syncedAt || null, mode: vault?.mode });
});
app.get('/api/security/export', (req, res) => {
  const p = provider(req);
  const anonymize = req.query.anonymize !== 'false';
  res.json({
    profile: anonymize ? anonymizeProfile(p.getProfile()) : p.getProfile(),
    screening: p.getScreening(),
    exportedAt: new Date().toISOString(),
    anonymized: anonymize,
    mode: req.dataMode,
  });
});

// ── Platform ──
app.get('/api/platform/status', (_, res) => res.json(getPlatformStatus()));
app.get('/api/platform/integrations', (_, res) => res.json(getPlatformStatus().integrations));
app.get('/api/platform/api-keys', (_, res) => res.json(getApiKeys()));
app.get('/api/platform/v1/vitals', (req, res) => res.json(platformVitals(req.query.anonymize === 'true')));
app.get('/api/platform/v1/screening', (req, res) => res.json(platformScreening(req.query.anonymize === 'true')));
app.get('/api/platform/v1/report', (req, res) => res.json(platformReport(req.query.anonymize === 'true')));
app.get('/api/platform/v1/analysis', (_, res) => res.json(platformAnalysis()));

app.listen(port, () => {
  console.log(`MedWear API http://localhost:${port} [双模式 · 真实AI · IP定位医院]`);
  console.log(`  真实 AI: ${isAiConfigured() ? '已配置 ✓' : '未配置 — 设置 OPENAI_API_KEY'}`);
  if (ALLOW_DEMO) {
    console.log('  演示账号: demo/demo123 或 admin/admin123 (仅 DEV / ALLOW_DEMO_AUTH)');
  }
});
