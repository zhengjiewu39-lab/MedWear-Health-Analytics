/** 临床筛查项目库 — 演示/真实模式共用结构 */

const EXTRA_TREND_KEYS = ['tumor', 'chronic', 'cardio', 'cancer', 'common', 'respiratory'];

function getExtendedCategories() {
  return [
    {
      id: 'tumor',
      name: '肿瘤早期风险',
      name_en: 'Early Tumor Risk',
      icon: 'oncology',
      riskLevel: 'low',
      score: 12,
      description: '综合血氧、活动量、体重与睡眠节律等间接指标，评估常见实体瘤早期信号。',
      description_en: 'Assesses early signals of common solid tumors using indirect indicators such as SpO₂, activity level, weight, and sleep rhythm.',
      items: [
        { name: '肺结节/肺癌', name_en: 'Pulmonary nodule / Lung cancer', risk: 8, level: 'low', indicators: ['血氧稳定 97-99%', '无夜间低氧事件', '呼吸率正常'], indicators_en: ['SpO₂ stable 97-99%', 'No nocturnal hypoxia events', 'Normal respiratory rate'], recommendation: '40 岁起建议低剂量 CT 筛查', recommendation_en: 'Low-dose CT screening advised from age 40' },
        { name: '结直肠肿瘤', name_en: 'Colorectal tumor', risk: 10, level: 'low', indicators: ['BMI 正常', '活动量充足'], indicators_en: ['Normal BMI', 'Adequate activity'], recommendation: '45 岁起结肠镜或 FIT 筛查', recommendation_en: 'Colonoscopy or FIT screening from age 45' },
        { name: '甲状腺结节', name_en: 'Thyroid nodule', risk: 15, level: 'low', indicators: ['静息心率稳定', 'HRV 正常'], indicators_en: ['Stable resting heart rate', 'Normal HRV'], recommendation: '年度甲状腺 B 超', recommendation_en: 'Annual thyroid ultrasound' },
        { name: '肝胆胰肿瘤', name_en: 'Hepatobiliary/pancreatic tumor', risk: 9, level: 'low', indicators: ['活动代谢正常', '睡眠节律规律'], indicators_en: ['Normal activity metabolism', 'Regular sleep rhythm'], recommendation: '有家族史建议 AFP、腹部 B 超', recommendation_en: 'AFP and abdominal ultrasound advised if family history' },
      ],
    },
    {
      id: 'cancer',
      name: '癌症专项筛查',
      name_en: 'Cancer-Specific Screening',
      icon: 'cancer',
      riskLevel: 'low',
      score: 14,
      description: '针对高发癌种的专项风险评估，结合年龄、性别与可穿戴行为模式。',
      description_en: 'Targeted risk assessment for high-incidence cancers, combining age, sex, and wearable behavior patterns.',
      items: [
        { name: '乳腺癌', name_en: 'Breast cancer', risk: 11, level: 'low', indicators: ['无持续疲劳', '活动量正常', '体重稳定'], indicators_en: ['No persistent fatigue', 'Normal activity', 'Stable weight'], recommendation: '40 岁起 mammography，高风险者 MRI 补充', recommendation_en: 'Mammography from age 40; MRI for high-risk individuals' },
        { name: '胃癌', name_en: 'Gastric cancer', risk: 13, level: 'low', indicators: ['无反复消化不适记录', '睡眠规律'], indicators_en: ['No recurrent digestive discomfort records', 'Regular sleep'], recommendation: '45 岁起幽门螺杆菌检测 + 胃镜（高危人群）', recommendation_en: 'H. pylori test from age 45 + gastroscopy (high-risk groups)' },
        { name: '肝癌', name_en: 'Liver cancer', risk: 10, level: 'low', indicators: ['活动代谢正常', '无酒精相关行为模式'], indicators_en: ['Normal activity metabolism', 'No alcohol-related behavior patterns'], recommendation: '乙肝/丙肝携带者每 6 月 AFP + 超声', recommendation_en: 'AFP + ultrasound every 6 months for HBV/HCV carriers' },
        { name: '前列腺癌', name_en: 'Prostate cancer', risk: 7, level: 'low', indicators: ['排尿相关无异常自述', '夜间起夜正常'], indicators_en: ['No self-reported urinary abnormalities', 'Normal nocturia'], recommendation: '50 岁起 PSA 检测（有家族史 45 岁）', recommendation_en: 'PSA test from age 50 (age 45 if family history)' },
        { name: '宫颈癌', name_en: 'Cervical cancer', risk: 6, level: 'low', indicators: ['适龄女性常规筛查'], indicators_en: ['Routine screening for eligible women'], recommendation: '21 岁起 HPV/TCT 联合筛查', recommendation_en: 'Co-testing with HPV/TCT from age 21' },
      ],
    },
    {
      id: 'chronic',
      name: '慢性病风险',
      name_en: 'Chronic Disease Risk',
      icon: 'chronic',
      riskLevel: 'moderate',
      score: 28,
      description: '高血压、糖尿病、血脂、COPD、睡眠呼吸暂停等慢病风险分层。',
      description_en: 'Risk stratification for chronic conditions including hypertension, diabetes, dyslipidemia, COPD, and sleep apnea.',
      items: [
        { name: '高血压', name_en: 'Hypertension', risk: 32, level: 'moderate', indicators: ['收缩压均值略高', '偶超 120 上限'], indicators_en: ['Slightly elevated mean systolic pressure', 'Occasionally exceeds 120 upper limit'], recommendation: '24h 动态血压监测', recommendation_en: '24h ambulatory blood pressure monitoring' },
        { name: '2 型糖尿病', name_en: 'Type 2 diabetes', risk: 14, level: 'low', indicators: ['空腹血糖正常', 'BMI 正常', '运动达标'], indicators_en: ['Normal fasting glucose', 'Normal BMI', 'Meets exercise targets'], recommendation: '每年空腹血糖 + HbA1c', recommendation_en: 'Annual fasting glucose + HbA1c' },
        { name: '血脂异常', name_en: 'Dyslipidemia', risk: 22, level: 'low', indicators: ['活动消耗达标', 'BMI 正常'], indicators_en: ['Meets activity expenditure targets', 'Normal BMI'], recommendation: '体检加查血脂四项', recommendation_en: 'Add lipid panel to checkup' },
        { name: '慢性阻塞性肺病', name_en: 'Chronic obstructive pulmonary disease', risk: 6, level: 'low', indicators: ['血氧 ≥96%', '呼吸率正常'], indicators_en: ['SpO₂ ≥96%', 'Normal respiratory rate'], recommendation: '吸烟者建议肺通气功能', recommendation_en: 'Spirometry advised for smokers' },
        { name: '睡眠呼吸暂停', name_en: 'Sleep apnea', risk: 18, level: 'low', indicators: ['睡眠效率良好', 'SpO2 夜间稳定'], indicators_en: ['Good sleep efficiency', 'SpO₂ stable at night'], recommendation: '打鼾明显者做多导睡眠监测', recommendation_en: 'Polysomnography for notable snoring' },
        { name: '慢性肾病', name_en: 'Chronic kidney disease', risk: 12, level: 'low', indicators: ['无水肿相关活动异常', '血压可控'], indicators_en: ['No edema-related activity abnormalities', 'Blood pressure under control'], recommendation: '尿常规 +  eGFR 年度筛查', recommendation_en: 'Annual urinalysis + eGFR screening' },
      ],
    },
    {
      id: 'cardio',
      name: '心脑血管事件',
      name_en: 'Cardio-Cerebrovascular Events',
      icon: 'heart',
      riskLevel: 'low',
      score: 16,
      description: 'Framingham 简化模型 + HRV、静息心率、活动量综合评估。',
      description_en: 'Combined assessment using a simplified Framingham model plus HRV, resting heart rate, and activity level.',
      items: [
        { name: '冠心病/心梗', name_en: 'Coronary heart disease / Myocardial infarction', risk: 12, level: 'low', indicators: ['静息 HR 正常', 'HRV 稳定'], indicators_en: ['Normal resting HR', 'Stable HRV'], recommendation: '40 岁起心电图、运动负荷试验', recommendation_en: 'ECG and exercise stress test from age 40' },
        { name: '脑卒中', name_en: 'Stroke', risk: 15, level: 'low', indicators: ['血压 borderline', '心律稳定'], indicators_en: ['Borderline blood pressure', 'Stable heart rhythm'], recommendation: '控制血压，颈动脉超声可选', recommendation_en: 'Control blood pressure; carotid ultrasound optional' },
        { name: '心律失常', name_en: 'Arrhythmia', risk: 10, level: 'low', indicators: ['ECG 未见房颤', 'HRV 波动正常'], indicators_en: ['No atrial fibrillation on ECG', 'Normal HRV variation'], recommendation: '继续佩戴 ECG 监测', recommendation_en: 'Continue ECG monitoring' },
        { name: '心力衰竭风险', name_en: 'Heart failure risk', risk: 11, level: 'low', indicators: ['活动耐量正常', '无活动后血氧下降'], indicators_en: ['Normal exercise tolerance', 'No post-activity SpO₂ drop'], recommendation: 'BNP/NT-proBNP 年度检测（高危人群）', recommendation_en: 'Annual BNP/NT-proBNP test (high-risk groups)' },
      ],
    },
    {
      id: 'common',
      name: '常见小病 · 早期预警',
      name_en: 'Common Ailments · Early Warning',
      icon: 'common',
      riskLevel: 'low',
      score: 22,
      description: '基于体温趋势、活动骤降、睡眠紊乱、HRV 波动等，预警感冒、流感等上呼吸道与常见急性病倾向。',
      description_en: 'Warns of colds, flu, and other upper-respiratory or common acute illnesses based on temperature trends, activity drops, sleep disruption, and HRV fluctuations.',
      items: [
        { name: '普通感冒', name_en: 'Common cold', risk: 18, level: 'low', indicators: ['无持续活动量骤降', '体温无异常波动', '血氧正常'], indicators_en: ['No sustained activity drop', 'No abnormal temperature fluctuation', 'Normal SpO₂'], recommendation: '季节交替注意保暖，多饮水休息', recommendation_en: 'Keep warm during season changes; hydrate and rest' },
        { name: '流行性感冒', name_en: 'Influenza', risk: 15, level: 'low', indicators: ['无连续 3 天活动减半', 'HRV 无骤降'], indicators_en: ['No 3 consecutive days of halved activity', 'No sharp HRV drop'], recommendation: '流感季建议接种疫苗，出现发热及时就医', recommendation_en: 'Vaccination advised in flu season; seek care promptly if fever occurs' },
        { name: '急性上呼吸道感染', name_en: 'Acute upper respiratory infection', risk: 20, level: 'low', indicators: ['呼吸率正常', '血氧 ≥95%'], indicators_en: ['Normal respiratory rate', 'SpO₂ ≥95%'], recommendation: '症状 3 天未缓解请发热门诊就诊', recommendation_en: 'Visit fever clinic if symptoms persist beyond 3 days' },
        { name: '过敏性鼻炎', name_en: 'Allergic rhinitis', risk: 25, level: 'low', indicators: ['季节性 HRV 轻微波动', '睡眠轻度受影响'], indicators_en: ['Mild seasonal HRV fluctuation', 'Slightly affected sleep'], recommendation: '花粉季减少户外暴露，必要时抗过敏治疗', recommendation_en: 'Reduce outdoor exposure in pollen season; use anti-allergy treatment if needed' },
        { name: '急性胃肠炎', name_en: 'Acute gastroenteritis', risk: 12, level: 'low', indicators: ['活动量无异常下降', '无脱水相关心率升高'], indicators_en: ['No abnormal activity decline', 'No dehydration-related heart rate rise'], recommendation: '饮食卫生，腹泻脱水及时补液', recommendation_en: 'Maintain food hygiene; rehydrate promptly if diarrhea causes dehydration' },
        { name: '偏头痛/紧张性头痛', name_en: 'Migraine / Tension headache', risk: 28, level: 'low', indicators: ['睡眠略不足', '压力指数偶升'], indicators_en: ['Slightly insufficient sleep', 'Occasionally elevated stress index'], recommendation: '规律作息，持续头痛需神经科评估', recommendation_en: 'Keep a regular routine; persistent headache needs neurology evaluation' },
        { name: '病毒性发热倾向', name_en: 'Viral fever tendency', risk: 16, level: 'low', indicators: ['静息心率无持续升高', '夜间睡眠完整'], indicators_en: ['No sustained resting heart rate rise', 'Intact nighttime sleep'], recommendation: '发热 ≥38.5°C 持续或伴呼吸困难请就医', recommendation_en: 'Seek care if fever ≥38.5°C persists or is accompanied by dyspnea' },
      ],
    },
    {
      id: 'respiratory',
      name: '呼吸系统筛查',
      name_en: 'Respiratory Screening',
      icon: 'respiratory',
      riskLevel: 'low',
      score: 19,
      description: '血氧、呼吸率、睡眠血氧波动与活动耐量，评估肺炎、哮喘等呼吸问题风险。',
      description_en: 'Evaluates risk of respiratory conditions such as pneumonia and asthma using SpO₂, respiratory rate, nocturnal SpO₂ variation, and exercise tolerance.',
      items: [
        { name: '社区获得性肺炎', name_en: 'Community-acquired pneumonia', risk: 14, level: 'low', indicators: ['SpO2 稳定', '无活动后血氧下降'], indicators_en: ['SpO₂ stable', 'No post-activity SpO₂ drop'], recommendation: '咳嗽伴发热、胸痛请胸片检查', recommendation_en: 'Chest X-ray if cough with fever or chest pain' },
        { name: '支气管哮喘', name_en: 'Bronchial asthma', risk: 22, level: 'low', indicators: ['夜间血氧无反复下降', '呼吸率变异正常'], indicators_en: ['No recurrent nocturnal SpO₂ drops', 'Normal respiratory rate variability'], recommendation: '喘息、胸闷发作做肺功能 + 舒张试验', recommendation_en: 'Spirometry + bronchodilator test for wheezing or chest tightness' },
        { name: '慢性支气管炎', name_en: 'Chronic bronchitis', risk: 17, level: 'low', indicators: ['无长期咳嗽活动模式', '血氧正常'], indicators_en: ['No chronic cough activity pattern', 'Normal SpO₂'], recommendation: '吸烟者优先戒烟并查肺功能', recommendation_en: 'Smokers should quit and undergo spirometry' },
        { name: '睡眠低氧事件', name_en: 'Sleep hypoxia events', risk: 13, level: 'low', indicators: ['夜间 SpO2 稳定', '睡眠效率 >85%'], indicators_en: ['SpO₂ stable at night', 'Sleep efficiency >85%'], recommendation: '疑似 OSA 做多导睡眠监测', recommendation_en: 'Polysomnography if OSA suspected' },
      ],
    },
  ];
}

function getDemoTrendData() {
  return [
    { month: '1月', tumor: 14, chronic: 30, cardio: 18, cancer: 16, common: 24, respiratory: 21 },
    { month: '2月', tumor: 13, chronic: 29, cardio: 17, cancer: 15, common: 23, respiratory: 20 },
    { month: '3月', tumor: 12, chronic: 28, cardio: 16, cancer: 14, common: 22, respiratory: 19 },
    { month: '4月', tumor: 12, chronic: 27, cardio: 16, cancer: 14, common: 21, respiratory: 19 },
    { month: '5月', tumor: 11, chronic: 28, cardio: 15, cancer: 13, common: 22, respiratory: 18 },
    { month: '6月', tumor: 12, chronic: 28, cardio: 16, cancer: 14, common: 22, respiratory: 19 },
  ];
}

function getRecommendedExams() {
  return [
    '24h 动态血压', '血脂四项', '空腹血糖+糖化血红蛋白', '腹部 B 超', '心电图',
    '低剂量胸部 CT', 'HPV/TCT', '流感疫苗接种', '过敏原检测', '肺功能检查',
  ];
}

function getRecommendedExamsEn() {
  return [
    '24h ambulatory blood pressure', 'Lipid panel (4 items)', 'Fasting glucose + HbA1c', 'Abdominal ultrasound', 'ECG',
    'Low-dose chest CT', 'HPV/TCT', 'Influenza vaccination', 'Allergen test', 'Pulmonary function test',
  ];
}

function buildRealScreeningCategories(store, stats, anomalies) {
  const day = Object.keys(store.daily || {}).sort().pop();
  const d = day ? store.daily[day] : null;
  const hrElevated = stats.restingHR > 85;
  const lowActivity = stats.steps < 4000;
  const lowSpo2 = stats.spo2 && stats.spo2 < 95;
  const lowSleep = stats.sleepHours && stats.sleepHours < 6;
  const lowHrv = stats.hrv && stats.hrv < 30;

  const recentActivityDrop = day && d && d.steps < 3000;

  return [
    {
      id: 'tumor', name: '肿瘤早期风险', name_en: 'Early Tumor Risk', riskLevel: 'low',
      score: Math.min(40, 10 + (anomalies.length * 3)),
      description: '基于真实 Apple Health 心率、血氧、活动量评估肿瘤相关间接风险。',
      description_en: 'Assesses tumor-related indirect risk based on real Apple Health heart rate, SpO₂, and activity.',
      items: [
        { name: '肺结节/肺癌', name_en: 'Pulmonary nodule / Lung cancer', risk: lowSpo2 ? 28 : 10, level: lowSpo2 ? 'moderate' : 'low', indicators: [`血氧 ${stats.spo2 ?? '—'}%`, `步数 ${stats.steps}`], indicators_en: [`SpO₂ ${stats.spo2 ?? '—'}%`, `Steps ${stats.steps}`], recommendation: '异常血氧请胸科/低剂量 CT 排查', recommendation_en: 'Abnormal SpO₂ warrants pulmonology / low-dose CT workup', evidenceLevel: 'B' },
        { name: '结直肠肿瘤', name_en: 'Colorectal tumor', risk: lowActivity ? 22 : 11, level: lowActivity ? 'moderate' : 'low', indicators: [`日均步数 ${stats.steps}`], indicators_en: [`Daily steps ${stats.steps}`], recommendation: '45 岁起 FIT 或肠镜筛查', recommendation_en: 'FIT or colonoscopy screening from age 45', evidenceLevel: 'A' },
      ],
    },
    {
      id: 'cancer', name: '癌症专项筛查', name_en: 'Cancer-Specific Screening', riskLevel: 'low',
      score: Math.min(35, 12 + (lowActivity ? 8 : 0)),
      description: '结合真实行为数据的高发癌种风险初筛（需影像/病理确诊）。',
      description_en: 'Initial screening for high-incidence cancers using real behavior data (requires imaging/pathology for diagnosis).',
      items: [
        { name: '胃癌', name_en: 'Gastric cancer', risk: lowSleep ? 20 : 12, level: lowSleep ? 'moderate' : 'low', indicators: [`睡眠 ${stats.sleepHours ?? '—'}h`], indicators_en: [`Sleep ${stats.sleepHours ?? '—'}h`], recommendation: '消化不适持续请胃镜检查', recommendation_en: 'Gastroscopy if digestive discomfort persists', evidenceLevel: 'B' },
        { name: '肝癌', name_en: 'Liver cancer', risk: 10, level: 'low', indicators: ['活动代谢来自真实记录'], indicators_en: ['Activity metabolism from real records'], recommendation: '高危人群 AFP + 超声', recommendation_en: 'AFP + ultrasound for high-risk groups', evidenceLevel: 'B' },
      ],
    },
    {
      id: 'chronic', name: '慢性病风险', name_en: 'Chronic Disease Risk',
      riskLevel: hrElevated || lowActivity ? 'moderate' : 'low',
      score: Math.min(50, (hrElevated ? 30 : 15) + (lowActivity ? 10 : 0)),
      description: '真实 wearable 数据驱动的慢病趋势分析。',
      description_en: 'Chronic disease trend analysis driven by real wearable data.',
      items: [
        { name: '高血压', name_en: 'Hypertension', risk: hrElevated ? 35 : 18, level: hrElevated ? 'moderate' : 'low', indicators: [`静息心率 ${stats.restingHR ?? '—'} bpm`], indicators_en: [`Resting HR ${stats.restingHR ?? '—'} bpm`], recommendation: '建议动态血压监测', recommendation_en: 'Ambulatory blood pressure monitoring advised', evidenceLevel: 'A' },
        { name: '2 型糖尿病', name_en: 'Type 2 diabetes', risk: lowActivity ? 25 : 12, level: lowActivity ? 'moderate' : 'low', indicators: [`步数 ${stats.steps}`], indicators_en: [`Steps ${stats.steps}`], recommendation: '活动不足者查空腹血糖', recommendation_en: 'Check fasting glucose if activity is insufficient', evidenceLevel: 'A' },
        { name: '睡眠呼吸暂停', name_en: 'Sleep apnea', risk: lowSpo2 || lowSleep ? 24 : 14, level: lowSpo2 ? 'moderate' : 'low', indicators: [`SpO2 ${stats.spo2 ?? '—'}%`, `睡眠 ${stats.sleepHours ?? '—'}h`], indicators_en: [`SpO₂ ${stats.spo2 ?? '—'}%`, `Sleep ${stats.sleepHours ?? '—'}h`], recommendation: '打鼾或低氧做多导睡眠监测', recommendation_en: 'Polysomnography for snoring or hypoxia', evidenceLevel: 'B' },
      ],
    },
    {
      id: 'cardio', name: '心脑血管事件', name_en: 'Cardio-Cerebrovascular Events', riskLevel: hrElevated || lowHrv ? 'moderate' : 'low',
      score: Math.min(45, 14 + (lowHrv ? 15 : 0)),
      description: '真实 HRV、静息心率评估心血管事件风险。',
      description_en: 'Assesses cardiovascular event risk using real HRV and resting heart rate.',
      items: [
        { name: '冠心病/心梗', name_en: 'Coronary heart disease / Myocardial infarction', risk: hrElevated ? 28 : 12, level: hrElevated ? 'moderate' : 'low', indicators: [`HR ${stats.heartRate}`, `HRV ${stats.hrv}`], indicators_en: [`HR ${stats.heartRate}`, `HRV ${stats.hrv}`], recommendation: '持续异常请心内科评估', recommendation_en: 'Persistent abnormalities warrant cardiology evaluation', evidenceLevel: 'A' },
        { name: '心律失常', name_en: 'Arrhythmia', risk: lowHrv ? 26 : 11, level: lowHrv ? 'moderate' : 'low', indicators: [`HRV ${stats.hrv ?? '—'} ms`], indicators_en: [`HRV ${stats.hrv ?? '—'} ms`], recommendation: '佩戴 ECG 持续监测', recommendation_en: 'Continuous ECG monitoring', evidenceLevel: 'B' },
      ],
    },
    {
      id: 'common', name: '常见小病 · 早期预警', name_en: 'Common Ailments · Early Warning',
      riskLevel: recentActivityDrop ? 'moderate' : 'low',
      score: Math.min(45, 18 + (recentActivityDrop ? 15 : 0)),
      description: '活动骤降、HRV 波动等提示感冒、流感等急性病倾向（非诊断）。',
      description_en: 'Activity drops and HRV fluctuations suggest tendency toward colds, flu, and other acute illnesses (not a diagnosis).',
      items: [
        { name: '普通感冒', name_en: 'Common cold', risk: recentActivityDrop ? 32 : 16, level: recentActivityDrop ? 'moderate' : 'low', indicators: [`今日步数 ${stats.steps}`, recentActivityDrop ? '活动量明显下降' : '活动正常'], indicators_en: [`Today's steps ${stats.steps}`, recentActivityDrop ? 'Marked activity decline' : 'Normal activity'], recommendation: '休息补水，3 天未缓解就医', recommendation_en: 'Rest and hydrate; seek care if not relieved in 3 days', evidenceLevel: 'C' },
        { name: '流行性感冒', name_en: 'Influenza', risk: recentActivityDrop && lowHrv ? 30 : 14, level: recentActivityDrop ? 'moderate' : 'low', indicators: [`HRV ${stats.hrv ?? '—'}`], indicators_en: [`HRV ${stats.hrv ?? '—'}`], recommendation: '高热肌肉酸痛请发热门诊', recommendation_en: 'Visit fever clinic for high fever and muscle aches', evidenceLevel: 'B' },
        { name: '急性上呼吸道感染', name_en: 'Acute upper respiratory infection', risk: lowSpo2 ? 28 : 18, level: lowSpo2 ? 'moderate' : 'low', indicators: [`血氧 ${stats.spo2 ?? '—'}%`], indicators_en: [`SpO₂ ${stats.spo2 ?? '—'}%`], recommendation: '血氧下降请呼吸科评估', recommendation_en: 'SpO₂ drop warrants pulmonology evaluation', evidenceLevel: 'B' },
        { name: '病毒性发热倾向', name_en: 'Viral fever tendency', risk: hrElevated && recentActivityDrop ? 35 : 15, level: hrElevated && recentActivityDrop ? 'moderate' : 'low', indicators: [`静息 HR ${stats.restingHR}`], indicators_en: [`Resting HR ${stats.restingHR}`], recommendation: '发热伴气促立即就医', recommendation_en: 'Seek immediate care for fever with shortness of breath', evidenceLevel: 'C' },
      ],
    },
    {
      id: 'respiratory', name: '呼吸系统筛查', name_en: 'Respiratory Screening', riskLevel: lowSpo2 ? 'moderate' : 'low',
      score: Math.min(40, 16 + (lowSpo2 ? 18 : 0)),
      description: '真实血氧与活动耐量评估呼吸系统风险。',
      description_en: 'Assesses respiratory risk using real SpO₂ and exercise tolerance.',
      items: [
        { name: '社区获得性肺炎', name_en: 'Community-acquired pneumonia', risk: lowSpo2 ? 30 : 12, level: lowSpo2 ? 'moderate' : 'low', indicators: [`SpO2 ${stats.spo2 ?? '—'}%`], indicators_en: [`SpO₂ ${stats.spo2 ?? '—'}%`], recommendation: '咳嗽发热胸痛请胸片', recommendation_en: 'Chest X-ray for cough, fever, or chest pain', evidenceLevel: 'B' },
        { name: '支气管哮喘', name_en: 'Bronchial asthma', risk: lowSpo2 ? 25 : 18, level: lowSpo2 ? 'moderate' : 'low', indicators: ['呼吸相关 wearable 指标'], indicators_en: ['Respiratory-related wearable metrics'], recommendation: '喘息发作查肺功能', recommendation_en: 'Spirometry for wheezing episodes', evidenceLevel: 'B' },
      ],
    },
  ];
}

function buildRealTrendData(store) {
  const days = Object.keys(store.daily || {}).sort().slice(-6);
  const labels = ['1月', '2月', '3月', '4月', '5月', '6月'];
  return days.map((dayKey, i) => {
    const d = store.daily[dayKey];
    const score = d ? Math.min(40, 100 - (d.steps / 200)) : 20;
    return {
      month: labels[i] || dayKey.slice(5),
      tumor: Math.round(score * 0.3),
      chronic: Math.round(score * 0.5),
      cardio: Math.round(score * 0.35),
      cancer: Math.round(score * 0.32),
      common: Math.round(score * 0.45),
      respiratory: Math.round(score * 0.38),
    };
  });
}

module.exports = {
  EXTRA_TREND_KEYS,
  getExtendedCategories,
  getDemoTrendData,
  getRecommendedExams,
  getRecommendedExamsEn,
  buildRealScreeningCategories,
  buildRealTrendData,
};
