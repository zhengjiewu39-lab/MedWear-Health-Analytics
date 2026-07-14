/**
 * Doctor report — editable demographics + wearable fusion + optional AI narrative.
 */

'use strict';

const { chatWithLLM, DOCTOR_SYSTEM_PROMPT } = require('../ai/llm');
const { isAiConfigured } = require('../ai/config');

/** @type {Map<string, object>} */
const PROFILES = new Map();

function computeBmi(heightCm, weightKg) {
  const h = Number(heightCm);
  const w = Number(weightKg);
  if (!h || !w || h < 50 || w < 20) return null;
  return +((w / ((h / 100) ** 2)).toFixed(1));
}

function bmiCategory(bmi) {
  if (bmi == null) return { zh: '未录入', en: 'Not recorded', flag: 'unknown' };
  if (bmi < 18.5) return { zh: '偏瘦', en: 'Underweight', flag: 'watch' };
  if (bmi < 24) return { zh: '正常', en: 'Normal', flag: 'normal' };
  if (bmi < 28) return { zh: '超重', en: 'Overweight', flag: 'watch' };
  return { zh: '肥胖', en: 'Obese', flag: 'warning' };
}

function profileKey(patientId) {
  return patientId || 'default';
}

function getProfile(patientId) {
  return { ...(PROFILES.get(profileKey(patientId)) || {}) };
}

function saveProfile(patientId, updates = {}) {
  const key = profileKey(patientId);
  const current = PROFILES.get(key) || {};
  const merged = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  if (merged.height != null && merged.weight != null) {
    merged.bmi = computeBmi(merged.height, merged.weight);
  }
  PROFILES.set(key, merged);
  return merged;
}

function mergePatient(basePatient, profile) {
  const height = profile.height ?? basePatient?.height ?? null;
  const weight = profile.weight ?? basePatient?.weight ?? null;
  const bmi = profile.bmi ?? computeBmi(height, weight) ?? basePatient?.bmi ?? null;
  return {
    ...basePatient,
    name: profile.name ?? basePatient?.name ?? '—',
    gender: profile.gender ?? basePatient?.gender ?? '—',
    gender_en: profile.gender_en ?? basePatient?.gender_en ?? profile.gender ?? '—',
    age: profile.age ?? basePatient?.age ?? null,
    height,
    weight,
    bmi,
    phone: profile.phone ?? basePatient?.phone ?? '—',
  };
}

const LEVEL_ORDER = { high: 0, moderate: 1, low: 2 };

function pushFactor(factors, seen, item, dedupeKey) {
  const key = dedupeKey ?? item.factor;
  if (seen.has(key)) return;
  seen.add(key);
  factors.push(item);
}

function vitalByLabel(vitals, pattern) {
  return (vitals || []).find((v) => pattern.test(v.label) || pattern.test(v.label_en || ''));
}

function buildRiskFactors(patient, report) {
  const factors = [];
  const seen = new Set();
  const push = (item, key) => pushFactor(factors, seen, item, key);
  const isHealthScore = report.overallScoreType === 'health' || report.mode === 'real';
  const meta = report.cohortMeta || {};
  const vitals = report.vitalsSnapshot || [];

  if (report.overallScore != null) {
    const risk = report.overallRisk || 'moderate';
    const riskZh = { low: '低', moderate: '中', high: '高', unknown: '待评估' }[risk] || '中';
    push({
      factor: isHealthScore
        ? `综合健康评分 ${report.overallScore}/100（${riskZh === '低' ? '良好' : riskZh === '高' ? '需重点随访' : '中等，建议加强监测'}）`
        : `综合风险指数 ${report.overallScore}/100（${riskZh}风险）`,
      factor_en: isHealthScore
        ? `Overall health score ${report.overallScore}/100 (${risk} tier)`
        : `Composite risk index ${report.overallScore}/100 (${risk} risk)`,
      level: risk === 'high' ? 'high' : risk === 'low' ? 'low' : 'moderate',
      source: 'composite',
    });
  }

  const bmi = patient.bmi;
  const cat = bmiCategory(bmi);
  if (bmi != null) {
    push({
      factor: `BMI ${bmi} kg/m²（${cat.zh}，参考 18.5–24）`,
      factor_en: `BMI ${bmi} kg/m² (${cat.en}, ref 18.5–24)`,
      level: cat.flag === 'warning' ? 'high' : cat.flag === 'watch' ? 'moderate' : 'low',
      source: 'demographics',
    });
  }

  if (patient.age != null) {
    if (patient.age >= 50) {
      push({
        factor: `年龄 ${patient.age} 岁（≥50，结直肠/肿瘤专项筛查推荐窗口）`,
        factor_en: `Age ${patient.age} (≥50 — colorectal/oncology screening window)`,
        level: 'moderate',
        source: 'demographics',
      });
    } else if (patient.age >= 40) {
      push({
        factor: `年龄 ${patient.age} 岁（≥40，建议启动常规肿瘤与慢病筛查）`,
        factor_en: `Age ${patient.age} (≥40 — routine cancer/chronic screening)`,
        level: 'moderate',
        source: 'demographics',
      });
    }
  }

  const gender = patient.gender || patient.gender_en || '';
  if (/女|female|F/i.test(gender) && patient.age != null && patient.age >= 40) {
    push({
      factor: '女性 ≥40 岁：建议乳腺专项筛查（可穿戴代理 + 影像加查）',
      factor_en: 'Female ≥40: breast screening recommended (wearable proxy + imaging)',
      level: 'moderate',
      source: 'demographics',
    });
  }

  if (meta.smoker) {
    push({
      factor: '吸烟史：肺癌 NLST 高危人群，建议低剂量胸部 CT',
      factor_en: 'Smoking history: NLST high-risk — low-dose chest CT advised',
      level: 'high',
      source: 'cohort',
    });
  }
  if (meta.familyHistory) {
    push({
      factor: '肿瘤/慢病家族史：遗传与聚集风险升高，建议加强专项筛查频率',
      factor_en: 'Family history of cancer/chronic disease — intensified screening',
      level: 'moderate',
      source: 'cohort',
    });
  }
  if (meta.malignant && meta.categoryLabel) {
    push({
      factor: `队列肿瘤相关类别：${meta.categoryLabel}（可穿戴信号已偏离健康基线）`,
      factor_en: `Cohort oncology category: ${meta.categoryLabel_en || meta.categoryLabel}`,
      level: meta.riskTier === 'high' ? 'high' : 'moderate',
      source: 'cohort',
    });
  } else if (meta.chronic && meta.categoryLabel) {
    push({
      factor: `慢病相关类别：${meta.categoryLabel}（需持续可穿戴监测与门诊随访）`,
      factor_en: `Chronic category: ${meta.categoryLabel_en || meta.categoryLabel}`,
      level: 'moderate',
      source: 'cohort',
    });
  }

  vitals.forEach((v) => {
    if (!v.flag || v.flag === 'normal') return;
    push({
      factor: `${v.label} ${v.value}${v.unit || ''}（参考 ${v.ref}，${v.flag === 'watch' ? '关注' : '异常'}）`,
      factor_en: `${v.label_en || v.label} ${v.value}${v.unit || ''} (ref ${v.ref}, ${v.flag})`,
      level: v.flag === 'watch' ? 'moderate' : 'high',
      source: 'wearable',
    }, `vital:${v.label}:${v.value}`);
  });

  const stepsV = vitalByLabel(vitals, /步数|steps/i);
  if (stepsV?.value != null && Number(stepsV.value) < 5000) {
    push({
      factor: `活动量不足：日均步数 ${stepsV.value}（目标 ≥6000，与代谢/心血管风险相关）`,
      factor_en: `Low activity: ${stepsV.value} steps/day (target ≥6000)`,
      level: Number(stepsV.value) < 3000 ? 'moderate' : 'low',
      source: 'lifestyle',
    });
  }
  const sleepV = vitalByLabel(vitals, /睡眠|sleep/i);
  if (sleepV?.value != null && Number(sleepV.value) < 6.5) {
    push({
      factor: `睡眠不足：${sleepV.value} h/夜（推荐 7–9 h，影响 HRV 与免疫恢复）`,
      factor_en: `Insufficient sleep: ${sleepV.value} h/night (recommended 7–9 h)`,
      level: Number(sleepV.value) < 6 ? 'moderate' : 'low',
      source: 'lifestyle',
    });
  }
  const hrvV = vitalByLabel(vitals, /HRV/i);
  if (hrvV?.value != null && Number(hrvV.value) < 25) {
    push({
      factor: `HRV 偏低：${hrvV.value} ms（自主神经负荷/压力或恢复不足）`,
      factor_en: `Low HRV: ${hrvV.value} ms (autonomic stress or poor recovery)`,
      level: Number(hrvV.value) < 20 ? 'moderate' : 'low',
      source: 'lifestyle',
    });
  }

  (report.screeningSummary || [])
    .filter((s) => s.riskLevel && s.riskLevel !== 'low')
    .forEach((s) => {
      push({
        factor: `AI 筛查 · ${s.name}：类别${s.riskLevel === 'high' ? '高' : '中'}风险（指数 ${s.score ?? '—'}）`,
        factor_en: `AI screening · ${s.name_en || s.name}: ${s.riskLevel} category risk`,
        level: s.riskLevel === 'high' ? 'high' : 'moderate',
        source: 'screening',
      }, `cat:${s.name}`);
    });

  (report.screeningHighlights || []).slice(0, 6).forEach((h) => {
    push({
      factor: `${h.category} · ${h.name}：风险 ${h.risk}%${h.recommendation ? ` — ${h.recommendation}` : ''}`,
      factor_en: `${h.category_en || h.category} · ${h.name_en || h.name}: ${h.risk}% risk`,
      level: h.level === 'high' ? 'high' : 'moderate',
      source: 'screening',
    }, `hl:${h.name}:${h.risk}`);
  });

  (report.anomalies || []).slice(0, 4).forEach((a) => {
    push({
      factor: `异常检测 · ${a.type}（置信度 ${a.confidence ?? '—'}%）${a.pattern ? `：${a.pattern}` : ''}`,
      factor_en: `Anomaly · ${a.type_en || a.type} (${a.confidence ?? '—'}% confidence)`,
      level: (a.confidence ?? 0) >= 85 ? 'high' : 'moderate',
      source: 'anomaly',
    }, `anomaly:${a.type}`);
  });

  (report.predictions || [])
    .filter((p) => p.level !== 'low' || (p.probability ?? 0) >= 25)
    .sort((a, b) => (b.probability ?? 0) - (a.probability ?? 0))
    .slice(0, 5)
    .forEach((p) => {
      const factorList = (p.factors || []).slice(0, 2).join('、');
      push({
        factor: `预测分析 · ${p.risk}：${p.probability}%（${p.timeframe}）${factorList ? ` — ${factorList}` : ''}`,
        factor_en: `Prediction · ${p.risk}: ${p.probability}% (${p.timeframe})`,
        level: p.level === 'high' ? 'high' : p.level === 'medium' || p.level === 'moderate' ? 'moderate' : 'low',
        source: 'prediction',
      }, `pred:${p.id || p.risk}`);
    });

  (report.alerts || []).slice(0, 2).forEach((a, i) => {
    push({
      factor: `实时预警 · ${a.message || a.title || a.type || '需关注信号'}`,
      factor_en: `Alert · ${a.message_en || a.message || a.title || 'signal of concern'}`,
      level: a.severity === 'critical' || a.severity === 'high' ? 'high' : 'moderate',
      source: 'wearable',
    }, `alert:${i}`);
  });

  if (!factors.length) {
    push({
      factor: '当前未发现显著风险因素，建议维持监测并年度健康体检',
      factor_en: 'No significant risk factors identified — maintain monitoring and annual checkup',
      level: 'low',
      source: 'composite',
    });
  }

  return factors
    .sort((a, b) => (LEVEL_ORDER[a.level] ?? 9) - (LEVEL_ORDER[b.level] ?? 9))
    .slice(0, 14);
}

function buildFollowUpPlan(patient, report) {
  const plan = [];
  const bmi = patient.bmi;
  if (bmi != null && bmi >= 24) {
    plan.push({
      action: '代谢评估：空腹血糖、HbA1c、血脂四项',
      action_en: 'Metabolic workup: fasting glucose, HbA1c, lipid panel',
      priority: 'medium',
      horizon: '4周内',
      horizon_en: 'Within 4 weeks',
    });
  }
  if (patient.age != null && patient.age >= 45) {
    plan.push({
      action: '按年龄风险启动结直肠/肿瘤专项筛查',
      action_en: 'Age-appropriate colorectal/oncology screening',
      priority: 'medium',
      horizon: '3个月内',
      horizon_en: 'Within 3 months',
    });
  }
  (report.recommendedExams || []).slice(0, 4).forEach((exam) => {
    plan.push({
      action: exam,
      action_en: (report.recommendedExams_en || [])[plan.length] || exam,
      priority: 'medium',
      horizon: '按需',
      horizon_en: 'As indicated',
    });
  });
  if (!plan.length) {
    plan.push({
      action: '维持可穿戴监测，6–12 个月常规体检',
      action_en: 'Continue wearable monitoring; routine checkup in 6–12 months',
      priority: 'low',
      horizon: '6个月内',
      horizon_en: 'Within 6 months',
    });
  }
  return plan.slice(0, 8);
}

function buildRuleBasedSummary(patient, report) {
  const scoreLabel = report.overallScoreType === 'health' || report.mode === 'real'
    ? `健康评分 ${report.overallScore}/100`
    : `综合风险指数 ${report.overallScore}/100`;
  const bmi = patient.bmi;
  const cat = bmiCategory(bmi);
  const lines = [
    `【患者】${patient.name} · ${patient.gender}${patient.age ? ` · ${patient.age}岁` : ''}${bmi ? ` · BMI ${bmi}（${cat.zh}）` : ''}`,
    `【可穿戴】${scoreLabel} · ${report.overallRisk === 'low' ? '低风险' : report.overallRisk === 'high' ? '高风险' : '中风险'}`,
  ];
  const watchVitals = (report.vitalsSnapshot || []).filter((v) => v.flag !== 'normal');
  if (watchVitals.length) {
    lines.push(`【关注指标】${watchVitals.map((v) => `${v.label} ${v.value}${v.unit || ''}`).join('、')}`);
  }
  const highlights = (report.screeningHighlights || []).slice(0, 3);
  if (highlights.length) {
    lines.push(`【筛查关注】${highlights.map((h) => `${h.name} ${h.risk}%`).join('、')}`);
  } else {
    lines.push('【筛查关注】当前无中高风险筛查项，建议维持监测');
  }
  const approved = (report.aiInterventions || []).length;
  if (approved) lines.push(`【已批准干预】${approved} 项 AI 干预已纳入报告`);
  lines.push('【说明】身高体重等人口学信息由接诊医师录入；可穿戴数据来自 Apple Health 真实导入');
  return lines.join('\n');
}

function buildReportContextBlock(patient, report) {
  return [
    '【医生报告上下文】',
    `患者: ${patient.name} · ${patient.gender} · ${patient.age ?? '—'}岁 · BMI ${patient.bmi ?? '—'}`,
    `健康/风险: ${report.overallScore}/100 · ${report.overallRisk}`,
    `生命体征: ${(report.vitalsSnapshot || []).map((v) => `${v.label}=${v.value}${v.unit || ''}`).join(', ')}`,
    `筛查关注: ${(report.screeningHighlights || []).map((h) => `${h.name} ${h.risk}%`).join('; ') || '无'}`,
    `异常: ${(report.anomalies || []).slice(0, 3).map((a) => a.type).join('; ') || '无'}`,
    `已批准干预: ${(report.aiInterventions || []).map((i) => i.title).join('; ') || '无'}`,
  ].join('\n');
}

async function generateAiNarrative(patient, report) {
  const prompt = `请基于以下真实可穿戴数据与医师录入的患者信息，撰写一份完整的临床接诊摘要（中文），包含：
1. 患者概况（含 BMI 解读，若未录入则说明）
2. 可穿戴监测要点（引用具体数值）
3. AI 筛查与风险分层结论
4. 建议随访/加查项目（3–5 条，可执行）
5. 局限性与医师裁量说明

要求：结构化、专业、不编造未提供的实验室/影像结果。`;

  const result = await chatWithLLM(prompt, {
    systemPrompt: `${DOCTOR_SYSTEM_PROMPT}\n\n你正在撰写供打印/导出的 MedWear 医生接诊报告正文。`,
    contextBlock: buildReportContextBlock(patient, report),
  });

  if (result.reply) {
    return {
      physicianSummary: result.reply,
      physicianSummary_en: null,
      aiGenerated: true,
      aiModel: result.model,
      aiProvider: result.provider,
    };
  }

  const fallback = buildRuleBasedSummary(patient, report);
  return {
    physicianSummary: fallback,
    physicianSummary_en: null,
    aiGenerated: false,
    aiModel: result.model || 'MedWear-RuleEngine-v1',
    aiNote: result.needsConfig
      ? 'AI 未配置，已使用规则引擎生成摘要（可在系统设置中配置 API Key 后重新生成）'
      : result.error,
    aiNote_en: result.needsConfig
      ? 'AI not configured — rule-engine summary used (configure API key in Settings to regenerate)'
      : result.error,
  };
}

function enrichReport(baseReport, profile, { useAi = false } = {}) {
  const patient = mergePatient(baseReport.patient, profile);
  const bmiCat = bmiCategory(patient.bmi);
  const riskFactors = buildRiskFactors(patient, baseReport);
  const followUpPlan = buildFollowUpPlan(patient, baseReport);

  const screeningSummary = (baseReport.screeningSummary || []).map((s) => ({
    ...s,
    healthScore: s.healthScore ?? (baseReport.overallScoreType === 'health' || baseReport.mode === 'real'
      ? Math.max(55, 100 - (s.score || 0))
      : null),
  }));

  let vitalsSnapshot = [...(baseReport.vitalsSnapshot || [])];
  if (patient.bmi != null && !vitalsSnapshot.some((v) => /BMI/i.test(v.label))) {
    vitalsSnapshot.push({
      label: 'BMI',
      label_en: 'BMI',
      value: patient.bmi,
      unit: '',
      ref: '18.5-24',
      flag: bmiCat.flag === 'normal' ? 'normal' : 'watch',
    });
  }

  const enriched = {
    ...baseReport,
    patient,
    vitalsSnapshot,
    screeningSummary,
    overallScoreLabel: baseReport.overallScoreType === 'health' || baseReport.mode === 'real'
      ? '健康评分（越高越好）'
      : '综合风险指数（越低越好）',
    overallScoreLabel_en: baseReport.overallScoreType === 'health' || baseReport.mode === 'real'
      ? 'Health score (higher is better)'
      : 'Risk index (lower is better)',
    demographicsNote: '姓名、性别、年龄、身高、体重由接诊医师录入；Apple Health 无法自动提供这些字段',
    demographicsNote_en: 'Name, sex, age, height and weight are entered by the clinician; Apple Health does not supply these fields',
    bmiAssessment: {
      value: patient.bmi,
      category: bmiCat.zh,
      category_en: bmiCat.en,
      flag: bmiCat.flag,
    },
    riskFactors,
    followUpPlan,
    clinicalAssessment: {
      summary: buildRuleBasedSummary(patient, { ...baseReport, screeningSummary }),
      riskFactorCount: riskFactors.length,
      dataDays: baseReport.dataCoverage?.days ?? baseReport.meta?.dayCount ?? null,
    },
    profileEditable: true,
    savedProfile: profile,
    aiConfigured: isAiConfigured(),
  };

  return enriched;
}

async function composeDoctorReport(baseReport, patientId, options = {}) {
  const profile = { ...getProfile(patientId), ...(options.profile || {}) };
  if (options.profile) saveProfile(patientId, options.profile);

  let report = enrichReport(baseReport, profile, options);

  if (options.useAi !== false && (options.regenerate || options.useAi)) {
    const ai = await generateAiNarrative(report.patient, report);
    report = {
      ...report,
      ...ai,
      generatedAt: new Date().toISOString(),
      reportId: baseReport.reportId || `MR-${patientId}-${Date.now().toString(36).toUpperCase()}`,
    };
  } else if (options.regenerate) {
    report = {
      ...report,
      physicianSummary: buildRuleBasedSummary(report.patient, report),
      aiGenerated: false,
      generatedAt: new Date().toISOString(),
    };
  }

  return report;
}

function reportToHtml(report) {
  const p = report.patient || {};
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const vitalsRows = (report.vitalsSnapshot || []).map((v) =>
    `<tr><td>${esc(v.label)}</td><td>${esc(v.value)} ${esc(v.unit)}</td><td>${esc(v.ref)}</td><td>${esc(v.flag)}</td></tr>`,
  ).join('');
  const riskRows = (report.riskFactors || []).map((r) =>
    `<li><strong>[${esc(r.level || '—')}]</strong> ${esc(r.factor)} <em>(${esc(r.source)})</em></li>`,
  ).join('');
  const planRows = (report.followUpPlan || []).map((f) =>
    `<li>${esc(f.action)} — ${esc(f.horizon)}</li>`,
  ).join('');

  return `<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8"/>
<title>MedWear ${esc(report.reportId)}</title>
<style>
body{font-family:system-ui,sans-serif;max-width:900px;margin:2rem auto;padding:0 1rem;color:#111}
h1{font-size:1.4rem;border-bottom:2px solid #1565C0;padding-bottom:.5rem}
.meta{color:#555;font-size:.9rem}
section{margin:1.5rem 0}
table{width:100%;border-collapse:collapse;font-size:.9rem}
th,td{border:1px solid #ddd;padding:.4rem .6rem;text-align:left}
th{background:#f5f5f5}
.summary{white-space:pre-wrap;background:#f8fafc;padding:1rem;border-radius:8px;border-left:4px solid #1565C0}
.footer{font-size:.75rem;color:#666;margin-top:2rem}
</style></head><body>
<h1>${esc(report.reportType)}</h1>
<p class="meta">报告编号 ${esc(report.reportId)} · 生成 ${esc(new Date(report.generatedAt).toLocaleString())}</p>
<section><h2>患者信息</h2>
<p><strong>${esc(p.name)}</strong> · ${esc(p.gender)} · ${esc(p.age)}岁 · ID ${esc(p.id)}<br/>
身高 ${esc(p.height)} cm · 体重 ${esc(p.weight)} kg · BMI ${esc(p.bmi)} (${esc(report.bmiAssessment?.category)})</p></section>
<section><h2>医师摘要</h2><div class="summary">${esc(report.physicianSummary)}</div></section>
<section><h2>生命体征</h2><table><thead><tr><th>指标</th><th>实测</th><th>参考</th><th>判定</th></tr></thead><tbody>${vitalsRows}</tbody></table></section>
<section><h2>风险因素</h2><ul>${riskRows || '<li>无显著风险因素</li>'}</ul></section>
<section><h2>随访计划</h2><ul>${planRows}</ul></section>
<p class="footer">${(report.clinicalNotes || []).map(esc).join(' · ')}</p>
</body></html>`;
}

function resetProfiles() {
  PROFILES.clear();
}

module.exports = {
  getProfile,
  saveProfile,
  mergePatient,
  computeBmi,
  enrichReport,
  composeDoctorReport,
  buildRuleBasedSummary,
  reportToHtml,
  resetProfiles,
};
