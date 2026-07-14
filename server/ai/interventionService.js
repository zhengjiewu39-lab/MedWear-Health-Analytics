/**
 * AI Intervention Service — AI proposes, clinicians/admins approve.
 *
 * Governance model:
 *   AI (anomaly + prediction + screening fusion) → intervention queue (pending)
 *   → physician/admin approve | reject → executed in care pathway
 */

'use strict';

const { runFullAnalysis, MODELS } = require('./engine');
const { getDemoPatientData, DEFAULT_ID } = require('../mock/demoPatientRegistry');
const { hasData } = require('../health/store');

/** @type {Map<string, { items: object[], seq: number, fingerprint?: string }>} */
const STORES = new Map();

const TYPE_META = {
  exam: { label: '体检加查', label_en: 'Additional exam', icon: 'exam' },
  monitoring: { label: '强化监测', label_en: 'Enhanced monitoring', icon: 'monitor' },
  lifestyle: { label: '生活方式', label_en: 'Lifestyle', icon: 'lifestyle' },
  referral: { label: '专科转诊', label_en: 'Specialist referral', icon: 'referral' },
  followup: { label: '随访复诊', label_en: 'Follow-up visit', icon: 'followup' },
};

function storeKey(patientId) {
  return patientId || DEFAULT_ID;
}

function getPatientStore(patientId) {
  const key = storeKey(patientId);
  if (!STORES.has(key)) STORES.set(key, { items: [], seq: 1 });
  return STORES.get(key);
}

function nextId(patientId) {
  const store = getPatientStore(patientId);
  const id = `AI-IV-${String(store.seq).padStart(4, '0')}`;
  store.seq += 1;
  return id;
}

function priorityFrom(probability, level) {
  if (probability >= 55 || level === 'high' || level === 'moderate') return 'high';
  if (probability >= 35 || level === 'medium') return 'medium';
  return 'low';
}

function buildItem(patientId, {
  source, sourceId, type, title, title_en, action, action_en,
  rationale, rationale_en, aiModel, confidence, priority, horizon,
}) {
  return {
    id: nextId(patientId),
    source,
    sourceId,
    type,
    typeLabel: TYPE_META[type]?.label || type,
    typeLabel_en: TYPE_META[type]?.label_en || type,
    title,
    title_en,
    action,
    action_en,
    rationale,
    rationale_en,
    aiModel,
    confidence: +confidence.toFixed(1),
    priority,
    horizon: horizon || null,
    patientId,
    status: 'pending',
    requiresHumanApproval: true,
    createdAt: new Date().toISOString(),
    reviewedAt: null,
    reviewedBy: null,
    reviewerRole: null,
    clinicianNote: null,
  };
}

function buildRealInterventionData() {
  if (!hasData()) return null;
  const { getAllAnalytics } = require('../health/analytics');
  const { getStore } = require('../health/store');
  const a = getAllAnalytics();
  if (!a.hasData) return null;
  const store = getStore();
  const profile = {
    name: store.meta?.userLabel || 'Apple Health 用户',
    age: null,
    gender: '—',
    device: a.devices?.[0]?.name || 'Apple Watch',
    dataMode: 'real',
    dataImported: true,
    hasData: true,
    dayCount: store.meta?.dayCount,
    dateRange: store.meta?.dateRange,
  };
  return {
    profile,
    dashboard: a.dashboard,
    stats: a.dashboard?.stats,
    diseaseScreening: a.screening,
    anomalies: a.anomalies || [],
    predictions: a.predictions || [],
  };
}

function dataFingerprint(data) {
  if (!data) return '';
  const m = data.cohortMeta || {};
  return [
    data.id,
    data.profile?.name,
    m.riskScore,
    m.category,
    m.arm,
    data.anomalies?.length,
    data.predictions?.length,
  ].join('|');
}

function patientMetaFromData(data, pid) {
  if (!data) return { id: pid };
  return {
    id: pid,
    name: data.profile?.name,
    age: data.profile?.age,
    gender: data.profile?.gender,
    scenario: data.profile?.scenario,
    scenario_en: data.profile?.scenario_en,
    arm: data.cohortMeta?.arm,
    categoryLabel: data.cohortMeta?.categoryLabel,
    categoryLabel_en: data.cohortMeta?.categoryLabel_en,
    riskTier: data.cohortMeta?.riskTier,
    healthScore: data.dashboard?.stats?.healthScore ?? data.stats?.healthScore,
  };
}

function addRealUserInterventions(pid, data, items) {
  const profile = data.profile || {};
  const stats = data.stats || data.dashboard?.stats || {};
  const name = profile.name || 'Apple Health 用户';
  const dayCount = profile.dayCount || 0;

  if (dayCount > 0) {
    items.push(buildItem(pid, {
      source: 'profile',
      sourceId: `${pid}-real-baseline`,
      type: 'monitoring',
      title: `${name} · Apple Health 真实数据监测`,
      title_en: `${name} · Apple Health real-data monitoring`,
      action: `基于 ${dayCount} 天真 wearable 数据，建议每周更新导出并复核异常/预测信号`,
      action_en: `Based on ${dayCount} days of real wearable data — re-export weekly and review anomaly/prediction signals`,
      rationale: `健康评分 ${stats.healthScore ?? '—'} · 步数 ${stats.steps ?? '—'} · 静息 HR ${stats.restingHR ?? '—'} bpm`,
      rationale_en: `Health score ${stats.healthScore ?? '—'} · steps ${stats.steps ?? '—'} · resting HR ${stats.restingHR ?? '—'} bpm`,
      aiModel: 'RealData-Context-v1',
      confidence: Math.min(92, 70 + Math.min(dayCount, 14) * 1.5),
      priority: stats.healthScore != null && stats.healthScore < 65 ? 'medium' : 'low',
      horizon: '7天内',
    }));
  }

  const scr = data.diseaseScreening;
  if (scr?.categories) {
    const topItems = scr.categories
      .flatMap((c) => c.items.map((item) => ({ ...item, categoryName: c.name })))
      .sort((a, b) => (b.risk || 0) - (a.risk || 0))
      .slice(0, 3);
    topItems.forEach((item) => {
      if (items.some((x) => x.source === 'screening' && x.sourceId === item.name)) return;
      items.push(buildItem(pid, {
        source: 'screening',
        sourceId: item.name,
        type: /癌|肿瘤/.test(item.name) ? 'exam' : 'followup',
        title: `${name} · ${item.name} · 真实数据筛查`,
        title_en: `${name} · ${item.name_en || item.name} · real-data screening`,
        action: item.recommendation,
        action_en: item.recommendation_en || item.recommendation,
        rationale: `真实 wearable 信号 · 风险 ${item.risk}% · ${item.categoryName || ''}`,
        rationale_en: `Real wearable signals · risk ${item.risk}% · ${item.categoryName || ''}`,
        aiModel: item.aiModel || 'MedWear-Real-Screen-v1',
        confidence: (item.confidence ?? 0.8) * 100,
        priority: priorityFrom(item.risk, item.level),
        horizon: '30天内',
      }));
    });
  }
}

function addPatientProfileInterventions(pid, data, items) {
  const profile = data.profile || {};
  const meta = data.cohortMeta || {};
  const di = data.deviceIntegration || {};
  const name = profile.name || pid;
  const riskPct = Math.round((meta.riskScore || 0) * 100);

  if (meta.riskTier === 'high' || meta.malignant || meta.chronic) {
    items.push(buildItem(pid, {
      source: 'profile',
      sourceId: pid,
      type: meta.malignant ? 'exam' : meta.chronic ? 'monitoring' : 'followup',
      title: `${name} · ${meta.categoryLabel || '个体'}管理方案`,
      title_en: `${name} · ${meta.categoryLabel_en || 'personalized'} care plan`,
      action: meta.malignant
        ? '优先安排肿瘤专项筛查套餐，2 周内复核可穿戴异常窗口'
        : meta.chronic
          ? '慢病门诊随访 + 强化可穿戴监测 14 天'
          : '专科评估与个体化随访计划',
      action_en: meta.malignant
        ? 'Priority oncology screening; re-check wearable anomaly window within 2 weeks'
        : meta.chronic
          ? 'Chronic-care follow-up + 14-day enhanced wearable monitoring'
          : 'Specialist evaluation and personalized follow-up',
      rationale: `${pid} · ${meta.arm === 'intervention' ? '干预组' : '对照组'} · 风险评分 ${riskPct} · 静息 HR ${data.stats?.restingHR ?? '—'} / SpO₂ ${data.stats?.spo2 ?? '—'}%`,
      rationale_en: `${pid} · ${meta.arm === 'intervention' ? 'intervention' : 'control'} · risk ${riskPct} · HR ${data.stats?.restingHR ?? '—'} / SpO₂ ${data.stats?.spo2 ?? '—'}%`,
      aiModel: 'PatientContext-Stratifier-v1',
      confidence: Math.min(95, 55 + riskPct * 0.4),
      priority: meta.riskTier === 'high' ? 'high' : 'medium',
      horizon: meta.malignant ? '14天内' : '30天内',
    }));
  }

  if (di.fusionLabel && (di.deviceCount || 0) >= 2) {
    items.push(buildItem(pid, {
      source: 'profile',
      sourceId: `${pid}-fusion`,
      type: 'monitoring',
      title: `${name} · 多设备融合监测优化`,
      title_en: `${name} · multi-device fusion monitoring`,
      action: `维持 ${di.deviceCount} 台设备同步，融合质量 ${di.fusedQuality}% 以上；单设备异常时以融合信号为准`,
      action_en: `Keep ${di.deviceCount} devices synced; trust fused signal (${di.fusedQuality}%) when single sensor drifts`,
      rationale: `${di.fusionLabel} · 主设备 ${di.primaryDevice} · 准确率提升 +${Math.round((di.accuracyGain || 0) * 100)}%`,
      rationale_en: `${di.fusionLabel_en} · primary ${di.primaryDevice_en} · accuracy gain +${Math.round((di.accuracyGain || 0) * 100)}%`,
      aiModel: 'DeviceFusion-Orchestrator-v1',
      confidence: di.fusedQuality || 88,
      priority: 'low',
      horizon: '持续',
    }));
  }

  if (meta.arm === 'intervention' && meta.riskTier !== 'low') {
    items.push(buildItem(pid, {
      source: 'profile',
      sourceId: `${pid}-arm`,
      type: 'followup',
      title: `${name} · 干预组可穿戴早筛随访`,
      title_en: `${name} · intervention-arm wearable screening follow-up`,
      action: '按研究路径完成 AI 干预审批 → 预约体检 → 结局随访',
      action_en: 'Complete AI intervention approval → book exam → outcome follow-up per study pathway',
      rationale: '干预组参与者：异常与预测信号已绑定至本患者 ID，不会与其他队列成员混用',
      rationale_en: 'Intervention participant: anomaly/prediction signals bound to this patient ID only',
      aiModel: 'StudyPathway-v1',
      confidence: 82,
      priority: 'medium',
      horizon: '30天内',
    }));
  }
}

function interventionOpts(patientId, demoData, realData) {
  const pid = storeKey(patientId);
  if (pid === 'real') {
    const data = realData !== undefined ? realData : buildRealInterventionData();
    return { patientId: pid, data };
  }
  const data = demoData || getDemoPatientData(pid);
  return { patientId: pid, data };
}

/** Synthesize intervention queue from AI signals (screening, anomalies, predictions, patient profile). */
function generateInterventions(opts = {}) {
  const { patientId, demoData, realData } = opts;
  const { patientId: pid, data } = interventionOpts(patientId, demoData, realData);
  const store = getPatientStore(pid);

  if (!data?.diseaseScreening) {
    store.items = [];
    return {
      generated: 0,
      interventions: [],
      patientId: pid,
      needsImport: pid === 'real',
    };
  }

  const items = [];
  runFullAnalysis(data);
  const scr = data.diseaseScreening;

  scr.categories.forEach((cat) => {
    cat.items
      .filter((i) => i.level === 'moderate' || i.level === 'high' || (pid === 'real' && (i.risk || 0) >= 18))
      .forEach((item) => {
        const type = /癌|肿瘤/.test(item.name) ? 'exam' : /高血压|糖尿病|血脂/.test(item.name) ? 'monitoring' : 'followup';
        items.push(buildItem(pid, {
          source: 'screening',
          sourceId: item.name,
          type,
          title: `${data.profile?.name || pid} · ${item.name} · AI 筛查预警`,
          title_en: `${data.profile?.name || pid} · ${item.name_en || item.name} · AI screening alert`,
          action: item.recommendation,
          action_en: item.recommendation_en || item.recommendation,
          rationale: `多模型融合风险 ${item.calibratedRisk ?? item.risk}%（${item.evidenceLabel || '证据分级 C'}），超出个体基线阈值`,
          rationale_en: `Ensemble risk ${item.calibratedRisk ?? item.risk}% (${item.evidenceLabel || 'evidence C'}), above personal baseline threshold`,
          aiModel: item.aiModel || 'MedWear-AI v3.0 Ensemble',
          confidence: (item.confidence ?? 0.85) * 100,
          priority: priorityFrom(item.risk, item.level),
          horizon: '30天内',
        }));
      });
  });

  data.anomalies
    .filter((a) => a.severity !== 'low' || a.confidence >= 75)
    .forEach((a) => {
      items.push(buildItem(pid, {
        source: 'anomaly',
        sourceId: String(a.id),
        type: a.severity === 'medium' ? 'monitoring' : 'followup',
        title: a.type,
        title_en: a.type_en || a.type,
        action: a.severity === 'medium'
          ? '连续 7 天复测 HRV/心率，若持续异常预约心内科'
          : '记录异常窗口，纳入下周随访',
        action_en: a.severity === 'medium'
          ? 'Re-test HRV/HR for 7 days; cardiology referral if persistent'
          : 'Log anomaly window for next-week follow-up',
        rationale: a.pattern,
        rationale_en: a.pattern_en || a.pattern,
        aiModel: a.aiModel,
        confidence: a.confidence,
        priority: a.severity === 'medium' ? 'medium' : 'low',
        horizon: '7天内',
      }));
    });

  data.predictions
    .filter((p) => p.probability >= 28 || p.level === 'medium')
    .forEach((p) => {
      const type = p.category === 'cardio' || p.category === 'metabolic' ? 'exam'
        : p.category === 'mental' || p.category === 'sleep' ? 'lifestyle' : 'monitoring';
      items.push(buildItem(pid, {
        source: 'prediction',
        sourceId: String(p.id),
        type,
        title: p.risk,
        title_en: p.risk,
        action: p.recommendation,
        action_en: p.recommendation,
        rationale: `预测概率 ${p.probability}%（${p.timeframe}）· 风险因素：${(p.factors || []).join('、')}`,
        rationale_en: `Predicted probability ${p.probability}% (${p.timeframe}) · factors: ${(p.factors || []).join(', ')}`,
        aiModel: p.model,
        confidence: Math.min(95, 60 + p.probability * 0.5),
        priority: priorityFrom(p.probability, p.level),
        horizon: p.timeframe,
      }));
    });

  if (pid === 'real') {
    addRealUserInterventions(pid, data, items);
    if (items.length === 0) {
      const stats = data.stats || data.dashboard?.stats || {};
      items.push(buildItem(pid, {
        source: 'profile',
        sourceId: `${pid}-wellness`,
        type: 'lifestyle',
        title: `${data.profile?.name || 'Apple Health 用户'} · 健康维持与监测`,
        title_en: `${data.profile?.name || 'Apple Health user'} · wellness maintenance`,
        action: '维持当前良好习惯，每月导出 Apple Health 并复核筛查/预测信号',
        action_en: 'Maintain current habits; re-export Apple Health monthly and review screening/prediction signals',
        rationale: `健康评分 ${stats.healthScore ?? '—'} · 当前为低风险，建议持续监测`,
        rationale_en: `Health score ${stats.healthScore ?? '—'} · low risk — continue monitoring`,
        aiModel: 'MedWear-Real-Screen-v1',
        confidence: 78,
        priority: 'low',
        horizon: '30天内',
      }));
    }
  } else {
    addPatientProfileInterventions(pid, data, items);
  }

  const seen = new Set();
  store.items = items.filter((it) => {
    const key = `${it.source}:${it.sourceId}:${it.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 20);

  store.fingerprint = dataFingerprint(data);

  return { generated: store.items.length, interventions: store.items, patientId: pid, patient: patientMetaFromData(data, pid) };
}

function ensureInterventions(patientId, demoData, realData) {
  const pid = storeKey(patientId);
  if (pid === 'real' && !hasData()) {
    return { generated: 0, interventions: [], patientId: pid, needsImport: true };
  }
  const raw = demoData || realData || (pid !== 'real' ? getDemoPatientData(pid) : buildRealInterventionData());
  const fp = dataFingerprint(raw);
  const store = getPatientStore(pid);
  if (!store.items.length || (fp && store.fingerprint !== fp)) {
    return generateInterventions({ patientId, demoData, realData });
  }
  const dataForMeta = demoData || realData || (pid !== 'real' ? getDemoPatientData(pid) : buildRealInterventionData());
  return {
    generated: store.items.length,
    interventions: store.items,
    patientId: pid,
    patient: patientMetaFromData(dataForMeta, pid),
  };
}

function getInterventions({ status, priority, source, patientId } = {}) {
  let list = [...getPatientStore(patientId).items];
  if (status) list = list.filter((i) => i.status === status);
  if (priority) list = list.filter((i) => i.priority === priority);
  if (source) list = list.filter((i) => i.source === source);
  return list;
}

function getApprovedInterventions(patientId) {
  return getPatientStore(patientId).items.filter((i) => i.status === 'approved');
}

function getSummary(patientId, patientMeta) {
  const store = getPatientStore(patientId);
  const pending = store.items.filter((i) => i.status === 'pending').length;
  const approved = store.items.filter((i) => i.status === 'approved').length;
  const rejected = store.items.filter((i) => i.status === 'rejected').length;
  const high = store.items.filter((i) => i.priority === 'high' && i.status === 'pending').length;
  const pid = storeKey(patientId);
  const fallbackData = pid !== 'real' ? getDemoPatientData(pid) : null;
  const patient = patientMeta || patientMetaFromData(fallbackData, pid);
  return {
    total: store.items.length,
    pending,
    approved,
    rejected,
    highPriorityPending: high,
    patientId: pid,
    patient,
    models: MODELS.map((m) => m.id),
    governance: {
      principle: 'AI 建议 · 医师/管理者最终裁定',
      principle_en: 'AI recommends · clinician/administrator decides',
      autoExecute: false,
      requiresApproval: true,
    },
  };
}

function findById(id, patientId) {
  return getPatientStore(patientId).items.find((i) => i.id === id) || null;
}

function approveIntervention(id, { user, role, note, patientId } = {}) {
  const item = findById(id, patientId);
  if (!item) return null;
  if (item.status !== 'pending') return { error: 'already_reviewed', item };
  item.status = 'approved';
  item.reviewedAt = new Date().toISOString();
  item.reviewedBy = user || 'admin';
  item.reviewerRole = role || 'administrator';
  item.clinicianNote = note || null;
  return item;
}

function rejectIntervention(id, { user, role, note, patientId } = {}) {
  const item = findById(id, patientId);
  if (!item) return null;
  if (item.status !== 'pending') return { error: 'already_reviewed', item };
  item.status = 'rejected';
  item.reviewedAt = new Date().toISOString();
  item.reviewedBy = user || 'admin';
  item.reviewerRole = role || 'administrator';
  item.clinicianNote = note || null;
  return item;
}

function resetStore(patientId) {
  if (patientId) {
    STORES.delete(storeKey(patientId));
    return;
  }
  STORES.clear();
}

if (!STORES.size) generateInterventions({ patientId: DEFAULT_ID });

module.exports = {
  generateInterventions,
  ensureInterventions,
  getInterventions,
  getApprovedInterventions,
  getSummary,
  approveIntervention,
  rejectIntervention,
  buildRealInterventionData,
  TYPE_META,
  resetStore,
};
