/**
 * Build clinical context payload for real LLM calls (doctor chat, anomaly review, etc.)
 */

const { getSummary } = require('./interventionService');
const { getOutcomeSummary } = require('../screening/outcomeModel');
const { isAiConfigured, loadConfig } = require('./config');

function summarizeScreening(screening) {
  if (!screening || screening.needsImport) return null;
  const top = (screening.categories || []).flatMap((c) =>
    (c.items || []).filter((i) => i.level === 'moderate' || i.level === 'high').map((i) => ({
      name: i.name,
      risk: i.calibratedRisk ?? i.risk,
      level: i.level,
      recommendation: i.recommendation,
    })),
  ).slice(0, 8);
  return {
    overallScore: screening.overallScore,
    overallRisk: screening.overallRisk,
    summary: screening.summary,
    topRisks: top,
    dataCoverage: screening.dataCoverage,
  };
}

function buildClinicalContext(provider, dataMode) {
  const profile = provider.getProfile();
  const screening = provider.getScreening();
  const anomalies = provider.getAnomalies() || [];
  const predictions = provider.getPredictions() || [];
  const doctorReport = provider.getDoctorReport();
  const healthCtx = provider.getHealthContext?.() || {};
  let interventions = { pending: 0, approved: 0 };
  try {
    const s = getSummary();
    interventions = { pending: s.pending, approved: s.approved, rejected: s.rejected };
  } catch { /* optional */ }

  let cohortHeadline = null;
  try {
    const o = getOutcomeSummary();
    cohortHeadline = o.headline;
  } catch { /* optional */ }

  const aiConfig = loadConfig();

  return {
    mode: dataMode,
    hasPersonalData: Boolean(profile?.hasData ?? profile?.dataImported),
    profile: {
      name: profile?.name,
      device: profile?.device,
      dayCount: profile?.dayCount,
    },
    vitals: healthCtx.hasData !== false ? {
      healthScore: healthCtx.healthScore,
      heartRate: healthCtx.heartRate,
      spo2: healthCtx.spo2,
      hrv: healthCtx.hrv,
      steps: healthCtx.steps,
      sleepHours: healthCtx.sleepHours,
    } : null,
    screening: summarizeScreening(screening),
    anomalies: anomalies.slice(0, 6).map((a) => ({
      type: a.type, pattern: a.pattern, severity: a.severity, confidence: a.confidence,
    })),
    predictions: predictions.slice(0, 6).map((p) => ({
      risk: p.risk, probability: p.probability, timeframe: p.timeframe, recommendation: p.recommendation,
    })),
    doctorReport: doctorReport?.needsImport ? null : {
      summary: doctorReport?.summary || doctorReport?.executiveSummary,
      riskLevel: doctorReport?.riskLevel,
    },
    interventions,
    cohortHeadline,
    aiConfigured: isAiConfigured(),
    aiProvider: aiConfig.providerLabel,
    aiModel: aiConfig.model,
  };
}

function formatContextForLLM(ctx) {
  return `【MedWear 临床平台上下文 · ${ctx.mode === 'real' ? '真实模式' : '演示模式'}】
个人数据: ${ctx.hasPersonalData ? '已导入' : '未导入（可使用队列/演示信号）'}
患者/用户: ${ctx.profile?.name || '—'} · 设备: ${ctx.profile?.device || '—'}

${ctx.vitals ? `近期指标: 健康分 ${ctx.vitals.healthScore ?? '—'} · HR ${ctx.vitals.heartRate ?? '—'} · SpO₂ ${ctx.vitals.spo2 ?? '—'}% · HRV ${ctx.vitals.hrv ?? '—'} · 步数 ${ctx.vitals.steps ?? '—'}` : '（无个人可穿戴时序数据）'}

临床筛查: ${ctx.screening ? `综合风险 ${ctx.screening.overallScore}/100（${ctx.screening.overallRisk}）· ${ctx.screening.summary || ''}` : '无'}
重点关注: ${(ctx.screening?.topRisks || []).map((r) => `${r.name} ${r.risk}%`).join('；') || '无'}

异常信号 (${ctx.anomalies.length}): ${ctx.anomalies.map((a) => `${a.type}(${a.severity})`).join('；') || '无'}
预测风险 (${ctx.predictions.length}): ${ctx.predictions.map((p) => `${p.risk} ${p.probability}%`).join('；') || '无'}

AI 干预队列: 待审 ${ctx.interventions.pending} · 已批准 ${ctx.interventions.approved}
队列研究指标: ${ctx.cohortHeadline ? `早诊率Δ ${(ctx.cohortHeadline.earlyDiagnosisRate?.delta * 100).toFixed(1)}% · 治疗率Δ ${(ctx.cohortHeadline.treatmentRate?.delta * 100).toFixed(1)}%` : '—'}

当前 LLM: ${ctx.aiConfigured ? `${ctx.aiProvider} / ${ctx.aiModel}` : '未配置'}`;
}

module.exports = { buildClinicalContext, formatContextForLLM, summarizeScreening };
