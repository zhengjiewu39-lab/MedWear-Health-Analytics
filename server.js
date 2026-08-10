require('dotenv').config();
const dns = require('dns');
try { dns.setDefaultResultOrder('ipv4first'); } catch { /* ignore */ }
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { getExamSlots } = require('./server/mock/clinicalData');
const { runFullAnalysis, getAllReferences } = require('./server/ai/engine');
const { doctorChat, getChatStatus } = require('./server/ai/chatService');
const { buildClinicalContext } = require('./server/ai/contextBuilder');
const { loadConfig, saveConfig, isAiConfigured, getApiKey } = require('./server/ai/config');
const { getProvider: getAiProvider } = require('./server/ai/providers');
const { testAiConnection } = require('./server/ai/llm');
const { authenticate, verifyToken, authMiddleware, ALLOW_DEMO } = require('./server/security/auth');
const { requestIdMiddleware, securityHeadersMiddleware } = require('./server/security/hardening');
const { audit, auditMiddleware, getAuditLog } = require('./server/security/audit');
const { saveVault, loadVault, anonymizeProfile, ALGO } = require('./server/security/crypto');
const fs = require('fs');
const path = require('path');
const { modeMiddleware, isRealMode } = require('./server/middleware/mode');
const { getProvider } = require('./server/data/provider');
const { registerDataRoutes } = require('./server/routes/data');
const { registerAdminRoutes } = require('./server/routes/admin');
const researchRoutes = require('./server/routes/research');
const { getFrameworkPayload, wearable: wearablePolicy, summarizeWearableResults } = require('./server/config/evaluationFramework');
const {
  generateInterventions, getInterventions, getApprovedInterventions,
  getSummary, approveIntervention, rejectIntervention,
  ensureInterventions, buildRealInterventionData,
  resetStore,
} = require('./server/ai/interventionService');
const {
  getOutcomeSummary, getFunnel, getSurvivalReference, getCohort, getScenarioSensitivity,
} = require('./server/screening/outcomeModel');
const { attachScoreMeta } = require('./server/config/scoreFieldMeta');
const { getMethodologyTransparency, renderMethodsMarkdown } = require('./server/config/methodologyTransparency');
const { missingDataSensitivity } = require('./server/services/behavioralHealthIndex');
const { geolocate, withSearchCoords } = require('./server/geo/location');
const {
  findNearbyHospitalsLive, rememberFacilities, recallFacilities,
} = require('./server/geo/hospitals');
const { getPatientOutcomeComparison } = require('./server/screening/patientOutcomeProjection');
const { resolveCohortDemoId } = require('./server/mock/cohortBundleFactory');
const {
  getProfile, saveProfile, composeDoctorReport, reportToHtml,
} = require('./server/reports/doctorReportService');
const { getDemoPatientData, getDemoPatientSummary, searchDemoPatients } = require('./server/mock/demoPatientRegistry');
const { hasData } = require('./server/health/store');
const { getSystemStack } = require('./server/config/systemStack');
const { isModelLoaded, loadModel, getModelInfo } = require('./server/ai/onnxInference');

const app = express();
const port = process.env.PORT || 3001;

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(requestIdMiddleware);
app.use(securityHeadersMiddleware);

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

const isProduction = process.env.NODE_ENV === 'production';
const apiRateLimitMax = Number(
  process.env.RATE_LIMIT_MAX || (isProduction ? 300 : 5000),
);

app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: apiRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: '请求过于频繁，请稍后再试' },
  skip: (req) => !isProduction && process.env.RATE_LIMIT_DEV === 'off',
}));
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isProduction ? 30 : 120,
  message: { success: false, message: '登录尝试过于频繁，请稍后再试' },
});
app.use(modeMiddleware);
app.use((req, res, next) => {
  const { resolveDemoPatientId } = require('./server/mock/demoPatientRegistry');
  req.demoPatientId = resolveDemoPatientId(req);
  if (!isRealMode(req)) {
    res.setHeader('X-MedWear-Demo-Patient', req.demoPatientId);
  }
  next();
});
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
  return getProvider(isRealMode(req) ? 'real' : 'demo', req);
}

// ── Auth ──
app.post('/api/auth/login', authLimiter, (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '').trim();
  const result = authenticate(username, password, req);
  if (result?.locked) {
    return res.status(429).json({ success: false, message: '登录尝试过多，请 15 分钟后再试' });
  }
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
  res.json({
    status: 'ok',
    service: 'MedWear API',
    version: '2.0',
    pid: process.pid,
    modes: ['demo', 'real'],
    features: ['onnx-inference', 'sqlite-health-store', 'robust-mad-anomaly', 'zod-validation', 'clinical-analytics', 'research-benchmarks', 'early-screening'],
    systemStack: getSystemStack(),
    benchmarks: {
      wearable: {
        name: wearablePolicy.dataset,
        n: wearablePolicy.n,
        version: wearablePolicy.version,
        labelSource: wearablePolicy.labelSource,
        evaluationModel: wearablePolicy.evaluationModel,
        alertMetrics: (() => {
          try {
            const p = path.join(__dirname, 'benchmarks/results/latest.json');
            if (!fs.existsSync(p)) return null;
            return summarizeWearableResults(JSON.parse(fs.readFileSync(p, 'utf8')))?.alertMetrics;
          } catch { return null; }
        })(),
      },
      screening: { name: 'MedWear-Screening-Outcome-Cohort-v1', n: 5000 },
    },
    evaluationFramework: getFrameworkPayload(),
  });
});

app.get('/api/system/stack', (_, res) => {
  res.json(getSystemStack());
});

app.get('/api/ai/model', async (_, res) => {
  try {
    if (!isModelLoaded()) await loadModel();
    res.json({
      loaded: isModelLoaded(),
      info: getModelInfo(),
      stack: getSystemStack().inference,
    });
  } catch (err) {
    res.status(503).json({
      loaded: false,
      error: err.message,
      stack: getSystemStack().inference,
    });
  }
});

app.get('/api/methodology', (req, res) => {
  const isEn = req.query.lang === 'en' || String(req.headers['x-medwear-lang'] || '').toLowerCase() === 'en';
  const evalName = isEn ? 'EVALUATION.md' : 'EVALUATION.zh.md';
  const evalPath = path.join(__dirname, 'docs', evalName);
  const transparency = getMethodologyTransparency();
  const parts = [renderMethodsMarkdown(isEn)];
  if (fs.existsSync(evalPath)) parts.push(fs.readFileSync(evalPath, 'utf8'));
  if (parts.length < 1) {
    return res.status(404).json({
      success: false,
      message: isEn ? 'Methodology documents not found' : '方法学文档未找到',
    });
  }
  return res.json({
    filename: isEn ? 'methodologyTransparency + docs/EVALUATION.md' : 'methodologyTransparency + docs/EVALUATION.zh.md',
    lang: isEn ? 'en' : 'zh',
    engine: 'MedWear-AnalyticsCore-v1',
    scoreKind: transparency.healthScore.kind,
    scoreLabel: isEn ? transparency.healthScore.label_en : transparency.healthScore.label_zh,
    transparency,
    framework: {
      ...getFrameworkPayload(),
      benchmark_license: 'CC-BY-4.0',
      benchmark_name: wearablePolicy.dataset,
      benchmark_name_zh: 'MedWear 可穿戴分析临床基准 v2',
      benchmark_n: wearablePolicy.n,
      benchmark_supersedes: 'MedWear-Wearable-Analytics-Mini-v1 (n=8)',
      evaluation_type: 'Engine vs independent clinical gold standard (not self-test)',
      evaluation_type_zh: '产品引擎 vs 独立临床金标准（非自评）',
      layers: [
        { id: 'L0', title: 'Proxy signals', title_zh: '代理信号' },
        { id: 'L1', title: 'Individual anomaly detection', title_zh: '个体异常检测' },
        { id: 'L2', title: 'Clinical screening', title_zh: '临床筛查' },
      ],
    },
    markdown: parts.join('\n\n---\n\n'),
  });
});

function apiLang(req) {
  return req.query.lang === 'en' || String(req.headers['x-medwear-lang'] || '').toLowerCase() === 'en' ? 'en' : 'zh';
}

// ── Profile & Dashboard ──
app.get('/api/profile', (req, res) => res.json(provider(req).getProfile()));
app.get('/api/standards', (req, res) => res.json(provider(req).getStandards()));
app.get('/api/dashboard/stats', (req, res) => res.json(attachScoreMeta(provider(req).getDashboardStats(), apiLang(req))));
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
app.get('/api/ai/analysis', async (req, res) => {
  try {
    const p = provider(req);
    let bundle;
    if (isRealMode(req)) {
      const { getStore } = require('./server/health/store');
      const { buildRealScreening } = require('./server/health/analytics');
      const store = getStore();
      const analytics = p.getDashboardStats?.() || {};
      bundle = {
        store,
        diseaseScreening: buildRealScreening(store),
        stats: analytics,
        profile: { name: store.meta?.userLabel || 'Apple Health 用户' },
      };
    } else {
      bundle = p.getRawDemoData?.();
    }
    res.json(await runFullAnalysis(bundle || undefined));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/demo/patients', (req, res) => {
  if (isRealMode(req)) {
    return res.json({ mode: 'real', patients: [], total: 0, activeId: null });
  }
  const result = searchDemoPatients({
    q: req.query.q,
    arm: req.query.arm,
    riskTier: req.query.riskTier,
    limit: Math.min(Number(req.query.limit) || 30, 100),
    offset: Math.max(Number(req.query.offset) || 0, 0),
  });
  res.json({
    mode: 'demo',
    activeId: req.demoPatientId,
    ...result,
    cohortMeta: { n: 5000, source: 'screening-outcome' },
  });
});

app.get('/api/demo/patients/:id', (req, res) => {
  if (isRealMode(req)) return res.status(404).json({ message: 'Not available in real mode' });
  const summary = getDemoPatientSummary(req.params.id);
  if (!summary) return res.status(404).json({ message: '患者不存在' });
  res.json({ patient: summary, activeId: req.demoPatientId });
});
app.get('/api/ai/research', (_, res) => res.json(getAllReferences()));

// ── AI Intervention (AI proposes, clinician/admin approves) ──
const INTERVENTION_IMPORT_MSG = '真实模式：请先导入 Apple Health 数据后再使用 AI 干预功能';
const INTERVENTION_IMPORT_MSG_EN = 'Real mode: import Apple Health data before using AI interventions';

function interventionScope(req) {
  if (isRealMode(req)) {
    return {
      patientId: 'real',
      realData: buildRealInterventionData(),
      needsImport: !hasData(),
    };
  }
  return { patientId: req.demoPatientId, demoData: getDemoPatientData(req.demoPatientId) };
}

function interventionImportResponse(res) {
  return res.status(403).json({
    success: false,
    needsImport: true,
    message: INTERVENTION_IMPORT_MSG,
    message_en: INTERVENTION_IMPORT_MSG_EN,
    total: 0,
    interventions: [],
    pending: 0,
    approved: 0,
    rejected: 0,
  });
}

function guardInterventionImport(req, res, scope) {
  if (scope.needsImport) {
    interventionImportResponse(res);
    return false;
  }
  return true;
}

app.get('/api/ai/interventions/summary', (req, res) => {
  const scope = interventionScope(req);
  if (!guardInterventionImport(req, res, scope)) return;
  const ensured = ensureInterventions(scope.patientId, scope.demoData, scope.realData);
  res.json(getSummary(scope.patientId, ensured.patient));
});
app.get('/api/ai/interventions', (req, res) => {
  const scope = interventionScope(req);
  if (!guardInterventionImport(req, res, scope)) return;
  ensureInterventions(scope.patientId, scope.demoData, scope.realData);
  const list = getInterventions({
    status: req.query.status,
    priority: req.query.priority,
    source: req.query.source,
    patientId: scope.patientId,
  });
  res.json({ total: list.length, interventions: list, patientId: scope.patientId });
});
app.post('/api/ai/interventions/generate', (req, res) => {
  const scope = interventionScope(req);
  if (!guardInterventionImport(req, res, scope)) return;
  resetStore(scope.patientId);
  try {
    const result = generateInterventions(scope);
    audit('AI_INTERVENTION_GENERATE', { user: resolveUser(req)?.username, detail: `${result.generated} items · ${scope.patientId}` });
    res.json(result);
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || '生成干预建议失败',
      message_en: err.message || 'Failed to generate interventions',
    });
  }
});
app.post('/api/ai/interventions/:id/approve', (req, res) => {
  const scope = interventionScope(req);
  if (!guardInterventionImport(req, res, scope)) return;
  const item = approveIntervention(req.params.id, {
    user: resolveUser(req)?.username,
    role: resolveUser(req)?.role,
    note: req.body?.note,
    patientId: scope.patientId,
  });
  if (!item) return res.status(404).json({ success: false, message: '干预建议不存在' });
  if (item.error) return res.status(409).json({ success: false, message: '已审批', item });
  audit('AI_INTERVENTION_APPROVE', { user: resolveUser(req)?.username, detail: item.id });
  res.json({ success: true, intervention: item });
});
app.post('/api/ai/interventions/:id/reject', (req, res) => {
  const scope = interventionScope(req);
  if (!guardInterventionImport(req, res, scope)) return;
  const item = rejectIntervention(req.params.id, {
    user: resolveUser(req)?.username,
    role: resolveUser(req)?.role,
    note: req.body?.note,
    patientId: scope.patientId,
  });
  if (!item) return res.status(404).json({ success: false, message: '干预建议不存在' });
  if (item.error) return res.status(409).json({ success: false, message: '已审批', item });
  audit('AI_INTERVENTION_REJECT', { user: resolveUser(req)?.username, detail: item.id });
  res.json({ success: true, intervention: item });
});

app.get('/api/ai/chat/status', (req, res) => {
  res.json(getChatStatus());
});

app.post('/api/ai/chat/test', async (req, res) => {
  if (!isAiConfigured()) {
    return res.status(503).json({ success: false, message: 'AI 未配置' });
  }
  const result = await doctorChat(
    { message: '请回复 OK', history: [] },
    provider(req),
    req.dataMode,
  );
  if (!result.success) {
    return res.status(502).json(result);
  }
  return res.json({ success: true, reply: result.reply, model: result.model });
});

app.get('/api/ai/chat/context', (req, res) => {
  res.json(buildClinicalContext(provider(req), req.dataMode));
});

app.post('/api/ai/chat', async (req, res) => {
  const { message, history } = req.body || {};
  if (!message || !String(message).trim()) {
    return res.status(400).json({ success: false, message: '请输入问题' });
  }
  const result = await doctorChat(
    { message: String(message).trim(), history: history || [] },
    provider(req),
    req.dataMode,
  );
  if (!result.success) {
    audit('AI_CHAT_FAILED', { user: resolveUser(req)?.username, detail: result.needsConfig ? 'not_configured' : 'error' });
    return res.status(result.needsConfig ? 503 : 502).json(result);
  }
  audit('AI_CHAT', { user: resolveUser(req)?.username, detail: `${result.provider}/${result.model}` });
  res.json(result);
});

app.post('/api/ai/analyze-anomaly', async (req, res) => {
  const langEn = String(req.headers['x-medwear-lang'] || req.query.lang || 'zh').toLowerCase() === 'en';
  const p = provider(req);
  const anomalies = p.getAnomalies();
  const targetId = req.body?.anomalyId;
  const a = (targetId != null
    ? anomalies.find((x) => `${x.id}` === `${targetId}`)
    : null) || anomalies[0];

  if (!a) {
    return res.status(404).json({
      success: false,
      needsImport: isRealMode(req),
      message: langEn
        ? 'No anomaly data yet — import Apple Health first'
        : '暂无异常数据，请先导入 Apple Health 数据',
    });
  }

  if (!isAiConfigured()) {
    return res.status(503).json({
      success: false,
      needsConfig: true,
      message: langEn
        ? 'Configure an AI provider and API Key in Settings. This system uses live LLMs only — no mock replies.'
        : '请先在「系统设置」配置 AI 提供商及 API Key，本系统仅使用真实 LLM，不提供模拟回复。',
    });
  }

  const typeLabel = langEn ? (a.type_en || a.type) : a.type;
  const patternLabel = langEn ? (a.pattern_en || a.pattern) : a.pattern;
  const prompt = langEn
    ? `Analyze this wearable anomaly signal in depth and give actionable clinical guidance:\nType: ${typeLabel}\nDescription: ${patternLabel}\nSeverity: ${a.severity}\nConfidence: ${a.confidence}%\nRespond in English.`
    : `请深度分析以下可穿戴异常信号并给出可执行的临床建议：\n类型：${typeLabel}\n描述：${patternLabel}\n严重度：${a.severity}\n置信度：${a.confidence}%`;

  const result = await doctorChat(
    { message: prompt, history: [] },
    p,
    req.dataMode,
  );

  if (!result.success) {
    return res.status(502).json(result);
  }

  return res.json({
    success: true,
    analysis: result.reply,
    confidence: a.confidence,
    recommendation: langEn
      ? 'Confirm with in-person examination; the physician retains final clinical judgment.'
      : '请结合线下体检确认，医师行使最终裁量权',
    model: result.model,
    provider: result.provider,
    isRealAi: true,
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
  try {
    let location = await geolocate(req);
    const geoFailed = location?.source === 'unavailable' || location?.lat == null;
    location = withSearchCoords(location);
    const radiusKm = Math.min(Number(req.query.radius) || 40, 100);
    const type = req.query.type && req.query.type !== 'all' ? req.query.type : null;
    const mode = isRealMode(req) ? 'real' : 'demo';

    // Both demo and real modes: realtime IP/GPS location + nearby medical facilities.
    const {
      facilities, source, searchRadiusKm, nearbyCount, expanded,
    } = await findNearbyHospitalsLive(location, { radiusKm, type, minResults: 6 });
    rememberFacilities(location.ip || `${location.lat},${location.lng}`, facilities);

    const warnings = [];
    if (geoFailed) {
      warnings.push('IP 定位失败，已使用默认坐标；请允许浏览器定位或在 .env 设置 MEDWEAR_GEO_*');
    } else if (location.fallback) {
      warnings.push('定位坐标为回退值，距离可能不准确');
    }
    if (location.source === 'browser-gps' && location.ipCity && location.city
      && location.ipCity !== location.city) {
      warnings.push(`浏览器定位为 ${location.city}，公网 IP（${location.ip}）归属地为 ${location.ipCity}（VPN/代理时常见）`);
    }
    if (expanded || nearbyCount === 0) {
      warnings.push(`已在 ${searchRadiusKm} km 范围内检索（上限 100 km）`);
    }
    if (!facilities.length) {
      warnings.push('当前定位 100 km 内暂未找到医疗体检机构，请允许浏览器定位后重试，或设置 MEDWEAR_GEO_*');
    }

    return res.json({
      mode,
      location,
      hospitals: facilities,
      dataSource: source,
      searchRadiusKm,
      nearbyCount,
      warning: warnings.length ? warnings.join('；') : undefined,
    });
  } catch (err) {
    try {
      const loc = withSearchCoords({ source: 'error-fallback', ip: 'unknown' });
      const { facilities } = await findNearbyHospitalsLive(loc, { radiusKm: 100, minResults: 6 });
      return res.json({
        mode: isRealMode(req) ? 'real' : 'demo',
        location: loc,
        hospitals: facilities,
        dataSource: 'catalog',
        warning: err.message || '医院列表加载失败，已返回本地目录',
      });
    } catch {
      return res.status(500).json({ message: err.message || '医院列表加载失败' });
    }
  }
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
  const {
    hospitalId, packageId, date, time, hospitalSnapshot,
  } = req.body;
  let hospital;
  if (isRealMode(req)) {
    let loc = withSearchCoords(await geolocate(req));
    let hospitals = recallFacilities(loc.ip);
    if (!hospitals) {
      ({ facilities: hospitals } = await findNearbyHospitalsLive(loc));
    }
    hospital = hospitals.find(h => `${h.id}` === `${hospitalId}`);
    // Live (OSM) result sets can drift between requests; fall back to the
    // snapshot the client selected so a valid booking never fails.
    if (!hospital && hospitalSnapshot && `${hospitalSnapshot.id}` === `${hospitalId}`) {
      hospital = hospitalSnapshot;
    }
  } else {
    hospital = p.getHospitals().find(h => `${h.id}` === `${hospitalId}`);
  }
  const pkg = p.getExamPackages().find(x => `${x.id}` === `${packageId}`);
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
app.get('/api/doctor-report', async (req, res) => {
  const base = provider(req).getDoctorReport();
  if (base?.needsImport) return res.json(base);
  const patientId = isRealMode(req) ? 'real' : req.demoPatientId;
  const approved = getApprovedInterventions(patientId);
  const summary = getSummary(patientId);
  const withInterventions = {
    ...base,
    aiInterventions: approved,
    aiGovernance: summary.governance,
    physicianAuthority: {
      label: '医师最终裁定',
      label_en: 'Physician final authority',
      note: approved.length
        ? `已纳入 ${approved.length} 项 AI 批准干预（医师可修改或追加）`
        : '尚无已批准 AI 干预，请先在 AI 干预中心审批',
      note_en: approved.length
        ? `${approved.length} AI-approved intervention(s) included (physician may modify or add)`
        : 'No approved AI interventions yet — review in AI Intervention Hub first',
    },
  };
  const report = await composeDoctorReport(withInterventions, patientId);
  res.json(report);
});

app.get('/api/doctor-report/profile', (req, res) => {
  const patientId = isRealMode(req) ? 'real' : req.demoPatientId;
  res.json({ patientId, profile: getProfile(patientId) });
});

app.put('/api/doctor-report/profile', (req, res) => {
  const patientId = isRealMode(req) ? 'real' : req.demoPatientId;
  const { name, gender, gender_en, age, height, weight, phone } = req.body || {};
  const profile = saveProfile(patientId, {
    ...(name != null && { name: String(name).trim() }),
    ...(gender != null && { gender: String(gender).trim() }),
    ...(gender_en != null && { gender_en: String(gender_en).trim() }),
    ...(age != null && age !== '' && { age: Number(age) }),
    ...(height != null && height !== '' && { height: Number(height) }),
    ...(weight != null && weight !== '' && { weight: Number(weight) }),
    ...(phone != null && { phone: String(phone).trim() }),
  });
  audit('DOCTOR_REPORT_PROFILE', { user: resolveUser(req)?.username, detail: patientId });
  res.json({ success: true, patientId, profile });
});

app.post('/api/doctor-report/generate', async (req, res) => {
  const base = provider(req).getDoctorReport();
  if (base?.needsImport) return res.status(403).json(base);
  const patientId = isRealMode(req) ? 'real' : req.demoPatientId;
  const approved = getApprovedInterventions(patientId);
  const summary = getSummary(patientId);
  const { profile, useAi = true } = req.body || {};
  try {
    const report = await composeDoctorReport({
      ...base,
      aiInterventions: approved,
      aiGovernance: summary.governance,
    }, patientId, { profile, regenerate: true, useAi: Boolean(useAi) });
    audit('DOCTOR_REPORT_GENERATE', { user: resolveUser(req)?.username, detail: `${patientId} · ai=${useAi}` });
    res.json(report);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/doctor-report/export', async (req, res) => {
  const base = provider(req).getDoctorReport();
  if (base?.needsImport) return res.status(403).json(base);
  const patientId = isRealMode(req) ? 'real' : req.demoPatientId;
  const approved = getApprovedInterventions(patientId);
  const report = await composeDoctorReport({ ...base, aiInterventions: approved }, patientId);
  const format = req.query.format || 'json';
  if (format === 'html') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="medwear-report-${report.reportId}.html"`);
    return res.send(reportToHtml(report));
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="medwear-report-${report.reportId}.json"`);
  res.json(report);
});

app.get('/api/methodology/transparency', (_, res) => {
  res.json(getMethodologyTransparency());
});

// ── Screening-outcome cohort (screened vs unscreened) ──
app.get('/api/outcomes/summary', (_, res) => res.json(getOutcomeSummary()));
app.get('/api/outcomes/scenarios', (_, res) => res.json(getScenarioSensitivity()));
app.get('/api/outcomes/funnel', (_, res) => res.json(getFunnel()));
app.get('/api/outcomes/survival-reference', (_, res) => res.json(getSurvivalReference()));
app.get('/api/outcomes/cohort', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 60, 500);
  const arm = req.query.arm;
  let { patients } = getCohort();
  if (arm === 'intervention' || arm === 'usual_care') {
    patients = patients.filter((p) => p.arm === arm);
  }
  res.json({ total: patients.length, patients: patients.slice(0, limit) });
});
app.get('/api/outcomes/patient-comparison', (req, res) => {
  if (isRealMode(req)) {
    const { hasData, getStore } = require('./server/health/store');
    const { buildUiDashboardStats } = require('./server/health/analytics');
    if (!hasData()) {
      return res.status(403).json({
        needsImport: true,
        message: '真实模式：请先导入 Apple Health 数据后再查看个体结局对比',
        message_en: 'Real mode: import Apple Health data before viewing individual outcome comparison',
      });
    }
    const store = getStore();
    const stats = buildUiDashboardStats(store);
    const demoProfile = getProfile('real');
    return res.json(getPatientOutcomeComparison('REAL-001', {
      mode: 'real',
      realProfile: {
        name: demoProfile.name || store.meta?.userLabel || 'Apple Health 用户',
        age: demoProfile.age,
        healthScore: stats.healthScore,
        category: stats.healthScore >= 80 ? 'healthy' : undefined,
      },
    }));
  }
  const patientId = resolveCohortDemoId(req.demoPatientId);
  const result = getPatientOutcomeComparison(patientId);
  if (result.error) return res.status(404).json(result);
  return res.json(result);
});

// ── Settings & AI Config ──
app.get('/api/settings', (req, res) => {
  const aiConfig = loadConfig();
  res.json({
    aiEnabled: true,
    aiProvider: aiConfig.provider,
    aiProviderLabel: aiConfig.providerLabel,
    aiModel: aiConfig.model,
    aiBaseUrl: aiConfig.baseUrl,
    aiProviders: aiConfig.availableProviders,
    confidenceThreshold: 85,
    aiModels: aiConfig.availableProviders.find((p) => p.id === aiConfig.provider)?.models || [],
    alertThresholds: { heartRateMax: 100, heartRateMin: 50, spo2Min: 95, glucoseMax: 11.1 },
    realtimeEnabled: true,
    autoSync: true,
    refreshInterval: 5,
    encryptionEnabled: true,
    encryptionAlgorithm: ALGO,
    auditLogEnabled: true,
    anonymizeExport: true,
    dataMode: req.dataMode,
    aiConfigured: aiConfig.apiKeySet,
    realAiAvailable: aiConfig.apiKeySet,
    securityLevel: 'enhanced-v2',
  });
});

app.post('/api/settings/ai', async (req, res) => {
  try {
    const { apiKey, model, baseUrl, provider, setActive, skipTest } = req.body;
    const providerId = provider || loadConfig().provider;
    const trimmedKey = apiKey?.trim();

    if (!trimmedKey && !loadConfig().apiKeySet) {
      return res.status(400).json({
        success: false,
        message: '请填写 API Key',
      });
    }

    const saved = saveConfig({
      apiKey: trimmedKey || undefined,
      model,
      baseUrl,
      provider: providerId,
      setActive: setActive !== false,
    });

    let testWarning = null;
    if (trimmedKey && !skipTest) {
      const test = await testAiConnection({
        providerId,
        apiKey: trimmedKey,
        model: model || getAiProvider(providerId).defaultModel,
      });
      if (!test.ok) {
        audit('AI_CONFIG_TEST_WARN', { user: resolveUser(req)?.username, detail: test.error?.slice(0, 120) });
        testWarning = test.error;
      }
    }

    audit('AI_CONFIG_UPDATE', { user: resolveUser(req)?.username, detail: `${saved.provider}/${saved.model}` });
    res.json({
      success: true,
      aiConfigured: saved.apiKeySet,
      provider: saved.provider,
      model: saved.model,
      tested: Boolean(trimmedKey && !skipTest),
      warning: testWarning,
      configPath: saved.configPath,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || '保存 AI 配置失败' });
  }
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

// ── Production: serve React build (single-port desktop / Docker app) ──
const buildDir = path.join(__dirname, 'build');
if (fs.existsSync(path.join(buildDir, 'index.html'))) {
  app.use(express.static(buildDir));
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(buildDir, 'index.html'));
  });
}

const httpServer = app.listen(port, () => {
  const hasUi = fs.existsSync(path.join(buildDir, 'index.html'));
  console.log(`MedWear API http://localhost:${port} [双模式 · 真实AI · IP定位医院]`);
  if (hasUi) {
    console.log(`MedWear 应用界面 http://localhost:${port} （前后端一体，可直接浏览器打开）`);
  } else {
    console.log('  提示: 运行 npm run build 后重启，可在同端口打开完整 Web 界面');
  }
  console.log(`  真实 AI: ${isAiConfigured() ? `已配置 ✓ (${loadConfig().provider}/${loadConfig().model})` : '未配置 — 系统设置或 .env DEEPSEEK_API_KEY'}`);
  if (isAiConfigured()) {
    const cfg = loadConfig();
    testAiConnection({ providerId: cfg.provider, apiKey: getApiKey(), model: cfg.model })
      .then((r) => {
        if (r.ok) console.log('  DeepSeek 连通: ✓ 启动自检通过');
        else console.log(`  DeepSeek 连通: ✗ ${r.error} — 运行 npm run test:ai 诊断`);
      })
      .catch((e) => console.log(`  DeepSeek 连通: ✗ ${e.message}`));
  }
  if (ALLOW_DEMO) {
    console.log('  管理员账号: admin/admin123 (仅 DEV / ALLOW_DEMO_AUTH)');
  }
});

httpServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n[MedWear] 端口 ${port} 已被占用 — AI 请求会出现 fetch failed。`);
    console.error('[MedWear] 请先运行: npm run stop');
    console.error('[MedWear] 然后重新: npm run app\n');
    process.exit(1);
  }
  console.error('[MedWear] 服务启动失败:', err.message);
  process.exit(1);
});
