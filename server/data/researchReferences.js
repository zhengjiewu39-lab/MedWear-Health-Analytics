/**
 * Condition research references — evidence levels are author annotations from public literature,
 * NOT independent third-party ratings.
 */

/** Author-defined evidence tier rules (not external agency ratings). */
const EVIDENCE_LEVEL_RULES = {
  A: {
    label_zh: 'A级 — 国际指南或高质量 RCT',
    label_en: 'Level A — international guideline or high-quality RCT',
    criteria_zh: '国际权威指南和/或高质量随机对照试验（含大型筛查 RCT、NEJM/Lancet 级 RCT）',
    criteria_en: 'International authoritative guidelines and/or high-quality RCTs (including major screening RCTs)',
  },
  B: {
    label_zh: 'B级 — 队列或验证研究',
    label_en: 'Level B — cohort or validation study',
    criteria_zh: '前瞻性队列、验证研究或国家级指南（非最高等级 RCT 直接证据）',
    criteria_en: 'Prospective cohorts, validation studies, or national guidelines without direct top-tier RCT',
  },
  C: {
    label_zh: 'C级 — 专家共识或间接证据',
    label_en: 'Level C — expert consensus or indirect evidence',
    criteria_zh: '专家共识、系统综述中的间接关联，或可穿戴代理信号与结局的弱关联文献',
    criteria_en: 'Expert consensus, indirect links in reviews, or weak wearable-proxy literature',
  },
};

const EVIDENCE_RATIONALE = {
  lung_cancer: {
    zh: 'NCCN 筛查指南 + NLST RCT；可穿戴 SpO₂/呼吸率为间接代理',
    en: 'NCCN screening guideline + NLST RCT; wearable SpO₂/resp rate are indirect proxies',
  },
  colorectal_cancer: {
    zh: 'USPSTF A 级推荐 + 国家卫健委指南 + 活动量 meta-analysis',
    en: 'USPSTF Grade A + national guideline + physical-activity meta-analysis',
  },
  breast_cancer: {
    zh: 'NCCN/WHO 乳腺癌筛查指南 — 直接筛查证据',
    en: 'NCCN/WHO breast screening guidelines — direct screening evidence',
  },
  gastric_cancer: {
    zh: '国家卫健委指南 + H. pylori  eradication NEJM RCT',
    en: 'National guideline + H. pylori eradication NEJM RCT',
  },
  prostate_cancer: {
    zh: 'USPSTF/EAU 前列腺癌筛查指南',
    en: 'USPSTF/EAU prostate screening guidelines',
  },
  cervical_cancer: {
    zh: 'WHO 2021 宫颈癌筛查与治疗指南',
    en: 'WHO 2021 cervical screening and treatment guideline',
  },
  thyroid: {
    zh: 'ATA 指南 + HRV 系统综述 — 可穿戴信号为间接代理（C→B 边界）',
    en: 'ATA guideline + HRV systematic review — wearables are indirect (borderline B/C)',
  },
  liver_cancer: {
    zh: 'AASLD HCC 筛查指南 + 可穿戴活动队列研究',
    en: 'AASLD HCC screening + wearable activity cohort study',
  },
  hypertension: {
    zh: '2023 ESH 指南 + 中国高血压指南 + 智能手表 BP 验证研究',
    en: '2023 ESH + China hypertension guidelines + smartwatch BP validation',
  },
  chronic_kidney_disease: {
    zh: 'KDIGO 2024 CKD 指南',
    en: 'KDIGO 2024 CKD guideline',
  },
  diabetes: {
    zh: 'ADA 2024 标准 + 中国 T2D 指南 + 活动/血糖队列',
    en: 'ADA 2024 Standards + China T2D guideline + activity/glucose cohort',
  },
  dyslipidemia: {
    zh: 'ACC/AHA 2019 一级预防指南 + 中国血脂指南 2023',
    en: 'ACC/AHA 2019 primary prevention + China lipid guideline 2023',
  },
  copd: {
    zh: 'GOLD 2024 全球策略 + 夜间 SpO₂ 可穿戴验证',
    en: 'GOLD 2024 strategy + nocturnal SpO₂ wearable validation',
  },
  respiratory: {
    zh: 'GINA 2024 + WHO 急性呼吸道感染概述 — 间接代理',
    en: 'GINA 2024 + WHO ARI overview — indirect wearable proxies',
  },
  sleep_apnea: {
    zh: 'AASM OSA 诊断指南 + 消费级可穿戴系统综述',
    en: 'AASM OSA testing guideline + consumer wearable systematic review',
  },
  coronary: {
    zh: '2023 ESC ACS 指南 + Framingham HRV 队列 + Apple Heart RCT',
    en: '2023 ESC ACS + Framingham HRV cohort + Apple Heart Study RCT',
  },
  stroke: {
    zh: 'AHA/ASA 2021 卒中预防指南 + 中国一级预防指南',
    en: 'AHA/ASA 2021 stroke prevention + China primary prevention guideline',
  },
  arrhythmia: {
    zh: '2023 ACC/AHA AF 指南 + 智能手表 AF meta-analysis',
    en: '2023 ACC/AHA AF guideline + smartwatch AF meta-analysis',
  },
};

const RESEARCH_DB = {
  lung_cancer: {
    id: 'lung_cancer',
    name: '肺结节/肺癌',
    evidenceLevel: 'B',
    model: 'MedWear-RuleEngine (respiratory)',
    references: [
      { title: 'NCCN Clinical Practice Guidelines: Lung Cancer Screening (2024)', org: 'NCCN', year: 2024, type: 'guideline', url: 'https://www.nccn.org/guidelines/guidelines-detail?category=1&id=1450' },
      { title: 'Reduced Lung-Cancer Mortality with Low-Dose Computed Tomographic Screening', org: 'NEJM (NLST)', year: 2011, type: 'rct', doi: '10.1056/NEJMoa1102873' },
      { title: 'WHO Global Tuberculosis Report — respiratory monitoring context', org: 'WHO', year: 2023, type: 'guideline', url: 'https://www.who.int/teams/global-programme-on-tuberculosis-and-lung-health' },
    ],
    metrics: ['SpO2 夜间波动', '呼吸率', '活动量衰减', 'HRV'],
    thresholds: { spo2Min: 95, respiratoryRate: [12, 20] },
  },
  colorectal_cancer: {
    id: 'colorectal_cancer',
    name: '结直肠肿瘤',
    evidenceLevel: 'A',
    model: 'MedWear-RuleEngine (oncology)',
    references: [
      { title: 'Screening for Colorectal Cancer: US Preventive Services Task Force Recommendation', org: 'USPSTF/JAMA', year: 2021, type: 'meta-analysis', doi: '10.1001/jama.2021.6234' },
      { title: '中国结直肠癌筛查与早诊早治指南 (2020)', org: '国家卫健委', year: 2020, type: 'guideline' },
      { title: 'Physical activity and colon cancer prevention: a meta-analysis', org: 'Br J Cancer', year: 2012, type: 'meta-analysis', doi: '10.1038/bjc.2011.584' },
    ],
    metrics: ['BMI', '日步数', '活动强度', '体重变化率'],
    thresholds: { bmi: [18.5, 24], stepsDaily: 8000 },
  },
  breast_cancer: {
    id: 'breast_cancer',
    name: '乳腺癌',
    evidenceLevel: 'A',
    model: 'MedWear-RuleEngine (oncology)',
    references: [
      { title: 'NCCN Clinical Practice Guidelines: Breast Cancer Screening and Diagnosis (2024)', org: 'NCCN', year: 2024, type: 'guideline' },
      { title: 'Breast cancer screening: WHO position paper', org: 'WHO', year: 2023, type: 'guideline' },
    ],
    metrics: ['BMI', '活动量', '睡眠规律', '体重变化率'],
    thresholds: { bmi: [18.5, 24], stepsDaily: 6000 },
  },
  gastric_cancer: {
    id: 'gastric_cancer',
    name: '胃癌',
    evidenceLevel: 'B',
    model: 'MedWear-RuleEngine (oncology)',
    references: [
      { title: '中国胃癌筛查与早诊早治指南 (2022)', org: '国家卫健委', year: 2022, type: 'guideline' },
      { title: 'Helicobacter pylori eradication for gastric cancer prevention', org: 'NEJM', year: 2020, type: 'rct', doi: '10.1056/NEJMoa1917066' },
    ],
    metrics: ['体重变化', '活动量', '睡眠', '营养代理指标'],
    thresholds: { bmi: [18.5, 24] },
  },
  prostate_cancer: {
    id: 'prostate_cancer',
    name: '前列腺癌',
    evidenceLevel: 'A',
    model: 'MedWear-RuleEngine (oncology)',
    references: [
      { title: 'Screening for Prostate Cancer: US Preventive Services Task Force Recommendation', org: 'USPSTF', year: 2018, type: 'guideline', doi: '10.1001/jama.2018.3710' },
      { title: 'EAU Guidelines on Prostate Cancer (2024)', org: 'EAU', year: 2024, type: 'guideline' },
    ],
    metrics: ['活动量', 'BMI', '年龄分层', '排尿相关症状（问卷）'],
    thresholds: { bmi: [18.5, 27], stepsDaily: 5000 },
  },
  cervical_cancer: {
    id: 'cervical_cancer',
    name: '宫颈癌',
    evidenceLevel: 'A',
    model: 'MedWear-RuleEngine (oncology)',
    references: [
      { title: 'WHO guideline for screening and treatment of cervical pre-cancer (2021)', org: 'WHO', year: 2021, type: 'guideline' },
      { title: '中国子宫颈癌综合防控指南', org: '中华预防医学会', year: 2023, type: 'guideline' },
    ],
    metrics: ['HPV 筛查（体检）', '活动量', '免疫相关代理指标'],
    thresholds: { stepsDaily: 5000 },
  },
  thyroid: {
    id: 'thyroid',
    name: '甲状腺结节',
    evidenceLevel: 'C',
    model: 'MedWear-RuleEngine (endocrine)',
    references: [
      { title: '2017 ATA Guidelines for Management of Thyroid Nodules', org: 'American Thyroid Association', year: 2017, type: 'guideline', doi: '10.1089/thy.2016.0229' },
      { title: 'Heart rate variability in thyroid dysfunction: systematic review', org: 'Endocrine', year: 2018, type: 'systematic-review', doi: '10.1007/s12020-018-1575-2' },
    ],
    metrics: ['静息心率', 'HRV RMSSD', '体温基线'],
    thresholds: { restingHR: [60, 80], hrv: [20, 70] },
  },
  liver_cancer: {
    id: 'liver_cancer',
    name: '肝胆胰肿瘤',
    evidenceLevel: 'B',
    model: 'MedWear-RuleEngine (hepato-oncology)',
    references: [
      { title: 'AASLD Practice Guidance on HCC screening', org: 'AASLD', year: 2023, type: 'guideline' },
      { title: 'Wearable activity monitors and metabolic syndrome: cohort study', org: 'Lancet Digital Health', year: 2022, type: 'cohort', doi: '10.1016/S2589-7500(22)00012-3' },
    ],
    metrics: ['活动消耗', '睡眠恢复', '持续疲劳指数'],
    thresholds: { activeCalories: 400 },
  },
  hypertension: {
    id: 'hypertension',
    name: '高血压',
    evidenceLevel: 'A',
    model: 'MedWear-RuleEngine (cardio)',
    references: [
      { title: '2023 ESH Guidelines for the management of arterial hypertension', org: 'European Society of Hypertension', year: 2023, type: 'guideline' },
      { title: '中国高血压防治指南 (2024年修订版)', org: '中国高血压联盟', year: 2024, type: 'guideline' },
      { title: 'Smartwatch-based blood pressure estimation validation study', org: 'Nature Digital Medicine', year: 2023, type: 'validation', doi: '10.1038/s41746-023-00812-4' },
    ],
    metrics: ['收缩压/舒张压', '静息心率', 'HRV', '夜间血压趋势'],
    thresholds: { systolic: [90, 120], diastolic: [60, 80] },
  },
  chronic_kidney_disease: {
    id: 'chronic_kidney_disease',
    name: '慢性肾病',
    evidenceLevel: 'A',
    model: 'MedWear-RuleEngine (renal)',
    references: [
      { title: 'KDIGO 2024 Clinical Practice Guideline for CKD Evaluation and Management', org: 'KDIGO', year: 2024, type: 'guideline' },
      { title: '中国慢性肾脏病早期筛查指南', org: '中华医学会肾脏病学分会', year: 2023, type: 'guideline' },
    ],
    metrics: ['血压', 'eGFR（体检）', '蛋白尿（体检）', '活动耐量'],
    thresholds: { systolic: [90, 130] },
  },
  diabetes: {
    id: 'diabetes',
    name: '2 型糖尿病',
    evidenceLevel: 'A',
    model: 'MedWear-RuleEngine (metabolic)',
    references: [
      { title: 'Standards of Care in Diabetes — 2024', org: 'American Diabetes Association', year: 2024, type: 'guideline', url: 'https://diabetesjournals.org/care/issue/47/Supplement_1' },
      { title: '中国2型糖尿病防治指南 (2020年版)', org: '中华医学会糖尿病学分会', year: 2020, type: 'guideline' },
      { title: 'Continuous glucose and activity fusion for T2D risk', org: 'Diabetes Care', year: 2021, type: 'cohort', doi: '10.2337/dc20-3122' },
    ],
    metrics: ['空腹血糖', 'HbA1c', 'BMI', '餐后活动', '睡眠'],
    thresholds: { fastingGlucose: [3.9, 6.1], hba1c: [4, 6.4] },
  },
  dyslipidemia: {
    id: 'dyslipidemia',
    name: '血脂异常',
    evidenceLevel: 'A',
    model: 'MedWear-RuleEngine (metabolic)',
    references: [
      { title: '2019 ACC/AHA Guideline on the Primary Prevention of Cardiovascular Disease', org: 'ACC/AHA', year: 2019, type: 'guideline', doi: '10.1161/CIR.0000000000000678' },
      { title: '中国成人血脂异常防治指南 (2023)', org: '中国血脂管理指南修订联合专家委员会', year: 2023, type: 'guideline' },
    ],
    metrics: ['BMI', '活动量', 'LDL-C（体检）'],
    thresholds: { ldl: 3.4, bmi: 24 },
  },
  copd: {
    id: 'copd',
    name: '慢性阻塞性肺病',
    evidenceLevel: 'A',
    model: 'MedWear-RuleEngine (respiratory)',
    references: [
      { title: 'Global Strategy for Prevention, Diagnosis and Management of COPD (GOLD 2024)', org: 'GOLD', year: 2024, type: 'guideline', url: 'https://goldcopd.org' },
      { title: 'Nocturnal desaturation detection via wearables', org: 'Chest', year: 2020, type: 'validation', doi: '10.1016/j.chest.2020.02.078' },
    ],
    metrics: ['SpO2', '呼吸率', '6分钟步行当量（步数推算）'],
    thresholds: { spo2: 95, respiratory: [12, 20] },
  },
  respiratory: {
    id: 'respiratory',
    name: '急性/过敏性呼吸道疾病',
    evidenceLevel: 'B',
    model: 'MedWear-RuleEngine (respiratory)',
    references: [
      { title: 'Global Initiative for Asthma (GINA 2024)', org: 'GINA', year: 2024, type: 'guideline' },
      { title: 'WHO overview of influenza and acute respiratory infection', org: 'WHO', year: 2023, type: 'guideline' },
    ],
    metrics: ['SpO₂', '呼吸率', '静息心率', '活动量变化'],
    thresholds: { spo2: 95, respiratory: [12, 20] },
  },
  sleep_apnea: {
    id: 'sleep_apnea',
    name: '睡眠呼吸暂停',
    evidenceLevel: 'B',
    model: 'MedWear-RuleEngine (sleep)',
    references: [
      { title: 'AASM Clinical Practice Guideline for Diagnostic Testing for OSA', org: 'AASM', year: 2017, type: 'guideline' },
      { title: 'Consumer wearables for sleep apnea screening: systematic review', org: 'Sleep Medicine Reviews', year: 2022, type: 'systematic-review', doi: '10.1016/j.smrv.2021.101552' },
    ],
    metrics: ['睡眠 SpO2 下降', '睡眠效率', 'BMI', '鼾声（可选）'],
    thresholds: { sleepEfficiency: 85, bmi: 25 },
  },
  coronary: {
    id: 'coronary',
    name: '冠心病/心梗',
    evidenceLevel: 'A',
    model: 'MedWear-RuleEngine (cardio)',
    references: [
      { title: '2023 ESC Guidelines for the management of acute coronary syndromes', org: 'ESC', year: 2023, type: 'guideline' },
      { title: 'Heart rate variability as predictor of cardiovascular events: Framingham offspring study', org: 'Circulation', year: 2015, type: 'cohort', doi: '10.1161/CIRCULATIONAHA.114.014467' },
      { title: 'Apple Heart Study: Atrial fibrillation detection', org: 'NEJM', year: 2019, type: 'rct', doi: '10.1056/NEJMoa1901183' },
    ],
    metrics: ['HRV', '静息心率', 'ECG', '活动耐量'],
    thresholds: { hrv: 40, restingHR: 80 },
  },
  stroke: {
    id: 'stroke',
    name: '脑卒中',
    evidenceLevel: 'A',
    model: 'MedWear-RuleEngine (cardio)',
    references: [
      { title: '2021 Guideline for the Prevention of Stroke in Patients With Stroke and TIA', org: 'AHA/ASA', year: 2021, type: 'guideline', doi: '10.1161/STR.0000000000000375' },
      { title: '中国脑血管病一级预防指南 2019', org: '中华医学会神经病学分会', year: 2019, type: 'guideline' },
    ],
    metrics: ['血压', '房颤检测', 'HRV', '活动水平'],
    thresholds: { systolic: 120 },
  },
  arrhythmia: {
    id: 'arrhythmia',
    name: '心律失常',
    evidenceLevel: 'A',
    model: 'MedWear-RuleEngine (cardio)',
    references: [
      { title: '2023 ACC/AHA/ACCP/HRS Guideline for AF Management', org: 'ACC/AHA', year: 2023, type: 'guideline' },
      { title: 'Smartwatch ECG for AF detection: meta-analysis', org: 'JAMA Cardiology', year: 2022, type: 'meta-analysis', doi: '10.1001/jamacardio.2022.0343' },
    ],
    metrics: ['ECG PPG', 'HRV', '不规则心跳通知'],
    thresholds: { hrv: 20 },
  },
};

const EVIDENCE_LABELS = {
  A: EVIDENCE_LEVEL_RULES.A.label_zh,
  B: EVIDENCE_LEVEL_RULES.B.label_zh,
  C: EVIDENCE_LEVEL_RULES.C.label_zh,
};

function attachEvidenceMeta(ref) {
  if (!ref) return ref;
  const rationale = EVIDENCE_RATIONALE[ref.id];
  return {
    ...ref,
    referenceDomainLabel: ref.model,
    evidenceRationale: rationale?.zh || null,
    evidenceRationale_en: rationale?.en || null,
  };
}

function getReference(id) {
  return attachEvidenceMeta(RESEARCH_DB[id] || null);
}

function getAllReferences() {
  return Object.values(RESEARCH_DB).map(attachEvidenceMeta);
}

function enrichScreeningItem(itemKey, item) {
  const ref = getReference(itemKey);
  if (!ref) return item;
  return {
    ...item,
    researchId: ref.id,
    evidenceLevel: ref.evidenceLevel,
    evidenceLabel: EVIDENCE_LABELS[ref.evidenceLevel],
    evidenceRationale: ref.evidenceRationale,
    evidenceRationale_en: ref.evidenceRationale_en,
    engineType: 'evidence-weighted-rule-engine',
    referenceDomainLabel: ref.referenceDomainLabel,
    measuredMetrics: ref.metrics,
    clinicalThresholds: ref.thresholds,
    references: ref.references,
    disclaimer: 'Author-assigned evidence tier from public literature — not an independent agency rating.',
  };
}

module.exports = {
  RESEARCH_DB,
  EVIDENCE_LEVEL_RULES,
  EVIDENCE_LABELS,
  EVIDENCE_RATIONALE,
  getReference,
  getAllReferences,
  enrichScreeningItem,
};
