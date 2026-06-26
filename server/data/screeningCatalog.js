/** 临床筛查项目库 — 演示/真实模式共用结构 */

const EXTRA_TREND_KEYS = ['tumor', 'chronic', 'cardio', 'cancer', 'common', 'respiratory'];

function getExtendedCategories() {
  return [
    {
      id: 'tumor',
      name: '肿瘤早期风险',
      icon: 'oncology',
      riskLevel: 'low',
      score: 12,
      description: '综合血氧、活动量、体重与睡眠节律等间接指标，评估常见实体瘤早期信号。',
      items: [
        { name: '肺结节/肺癌', risk: 8, level: 'low', indicators: ['血氧稳定 97-99%', '无夜间低氧事件', '呼吸率正常'], recommendation: '40 岁起建议低剂量 CT 筛查' },
        { name: '结直肠肿瘤', risk: 10, level: 'low', indicators: ['BMI 正常', '活动量充足'], recommendation: '45 岁起结肠镜或 FIT 筛查' },
        { name: '甲状腺结节', risk: 15, level: 'low', indicators: ['静息心率稳定', 'HRV 正常'], recommendation: '年度甲状腺 B 超' },
        { name: '肝胆胰肿瘤', risk: 9, level: 'low', indicators: ['活动代谢正常', '睡眠节律规律'], recommendation: '有家族史建议 AFP、腹部 B 超' },
      ],
    },
    {
      id: 'cancer',
      name: '癌症专项筛查',
      icon: 'cancer',
      riskLevel: 'low',
      score: 14,
      description: '针对高发癌种的专项风险评估，结合年龄、性别与可穿戴行为模式。',
      items: [
        { name: '乳腺癌', risk: 11, level: 'low', indicators: ['无持续疲劳', '活动量正常', '体重稳定'], recommendation: '40 岁起 mammography，高风险者 MRI 补充' },
        { name: '胃癌', risk: 13, level: 'low', indicators: ['无反复消化不适记录', '睡眠规律'], recommendation: '45 岁起幽门螺杆菌检测 + 胃镜（高危人群）' },
        { name: '肝癌', risk: 10, level: 'low', indicators: ['活动代谢正常', '无酒精相关行为模式'], recommendation: '乙肝/丙肝携带者每 6 月 AFP + 超声' },
        { name: '前列腺癌', risk: 7, level: 'low', indicators: ['排尿相关无异常自述', '夜间起夜正常'], recommendation: '50 岁起 PSA 检测（有家族史 45 岁）' },
        { name: '宫颈癌', risk: 6, level: 'low', indicators: ['适龄女性常规筛查'], recommendation: '21 岁起 HPV/TCT 联合筛查' },
      ],
    },
    {
      id: 'chronic',
      name: '慢性病风险',
      icon: 'chronic',
      riskLevel: 'moderate',
      score: 28,
      description: '高血压、糖尿病、血脂、COPD、睡眠呼吸暂停等慢病风险分层。',
      items: [
        { name: '高血压', risk: 32, level: 'moderate', indicators: ['收缩压均值略高', '偶超 120 上限'], recommendation: '24h 动态血压监测' },
        { name: '2 型糖尿病', risk: 14, level: 'low', indicators: ['空腹血糖正常', 'BMI 正常', '运动达标'], recommendation: '每年空腹血糖 + HbA1c' },
        { name: '血脂异常', risk: 22, level: 'low', indicators: ['活动消耗达标', 'BMI 正常'], recommendation: '体检加查血脂四项' },
        { name: '慢性阻塞性肺病', risk: 6, level: 'low', indicators: ['血氧 ≥96%', '呼吸率正常'], recommendation: '吸烟者建议肺通气功能' },
        { name: '睡眠呼吸暂停', risk: 18, level: 'low', indicators: ['睡眠效率良好', 'SpO2 夜间稳定'], recommendation: '打鼾明显者做多导睡眠监测' },
        { name: '慢性肾病', risk: 12, level: 'low', indicators: ['无水肿相关活动异常', '血压可控'], recommendation: '尿常规 +  eGFR 年度筛查' },
      ],
    },
    {
      id: 'cardio',
      name: '心脑血管事件',
      icon: 'heart',
      riskLevel: 'low',
      score: 16,
      description: 'Framingham 简化模型 + HRV、静息心率、活动量综合评估。',
      items: [
        { name: '冠心病/心梗', risk: 12, level: 'low', indicators: ['静息 HR 正常', 'HRV 稳定'], recommendation: '40 岁起心电图、运动负荷试验' },
        { name: '脑卒中', risk: 15, level: 'low', indicators: ['血压 borderline', '心律稳定'], recommendation: '控制血压，颈动脉超声可选' },
        { name: '心律失常', risk: 10, level: 'low', indicators: ['ECG 未见房颤', 'HRV 波动正常'], recommendation: '继续佩戴 ECG 监测' },
        { name: '心力衰竭风险', risk: 11, level: 'low', indicators: ['活动耐量正常', '无活动后血氧下降'], recommendation: 'BNP/NT-proBNP 年度检测（高危人群）' },
      ],
    },
    {
      id: 'common',
      name: '常见小病 · 早期预警',
      icon: 'common',
      riskLevel: 'low',
      score: 22,
      description: '基于体温趋势、活动骤降、睡眠紊乱、HRV 波动等，预警感冒、流感等上呼吸道与常见急性病倾向。',
      items: [
        { name: '普通感冒', risk: 18, level: 'low', indicators: ['无持续活动量骤降', '体温无异常波动', '血氧正常'], recommendation: '季节交替注意保暖，多饮水休息' },
        { name: '流行性感冒', risk: 15, level: 'low', indicators: ['无连续 3 天活动减半', 'HRV 无骤降'], recommendation: '流感季建议接种疫苗，出现发热及时就医' },
        { name: '急性上呼吸道感染', risk: 20, level: 'low', indicators: ['呼吸率正常', '血氧 ≥95%'], recommendation: '症状 3 天未缓解请发热门诊就诊' },
        { name: '过敏性鼻炎', risk: 25, level: 'low', indicators: ['季节性 HRV 轻微波动', '睡眠轻度受影响'], recommendation: '花粉季减少户外暴露，必要时抗过敏治疗' },
        { name: '急性胃肠炎', risk: 12, level: 'low', indicators: ['活动量无异常下降', '无脱水相关心率升高'], recommendation: '饮食卫生，腹泻脱水及时补液' },
        { name: '偏头痛/紧张性头痛', risk: 28, level: 'low', indicators: ['睡眠略不足', '压力指数偶升'], recommendation: '规律作息，持续头痛需神经科评估' },
        { name: '病毒性发热倾向', risk: 16, level: 'low', indicators: ['静息心率无持续升高', '夜间睡眠完整'], recommendation: '发热 ≥38.5°C 持续或伴呼吸困难请就医' },
      ],
    },
    {
      id: 'respiratory',
      name: '呼吸系统筛查',
      icon: 'respiratory',
      riskLevel: 'low',
      score: 19,
      description: '血氧、呼吸率、睡眠血氧波动与活动耐量，评估肺炎、哮喘等呼吸问题风险。',
      items: [
        { name: '社区获得性肺炎', risk: 14, level: 'low', indicators: ['SpO2 稳定', '无活动后血氧下降'], recommendation: '咳嗽伴发热、胸痛请胸片检查' },
        { name: '支气管哮喘', risk: 22, level: 'low', indicators: ['夜间血氧无反复下降', '呼吸率变异正常'], recommendation: '喘息、胸闷发作做肺功能 + 舒张试验' },
        { name: '慢性支气管炎', risk: 17, level: 'low', indicators: ['无长期咳嗽活动模式', '血氧正常'], recommendation: '吸烟者优先戒烟并查肺功能' },
        { name: '睡眠低氧事件', risk: 13, level: 'low', indicators: ['夜间 SpO2 稳定', '睡眠效率 >85%'], recommendation: '疑似 OSA 做多导睡眠监测' },
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
      id: 'tumor', name: '肿瘤早期风险', riskLevel: 'low',
      score: Math.min(40, 10 + (anomalies.length * 3)),
      description: '基于真实 Apple Health 心率、血氧、活动量评估肿瘤相关间接风险。',
      items: [
        { name: '肺结节/肺癌', risk: lowSpo2 ? 28 : 10, level: lowSpo2 ? 'moderate' : 'low', indicators: [`血氧 ${stats.spo2 ?? '—'}%`, `步数 ${stats.steps}`], recommendation: '异常血氧请胸科/低剂量 CT 排查', evidenceLevel: 'B' },
        { name: '结直肠肿瘤', risk: lowActivity ? 22 : 11, level: lowActivity ? 'moderate' : 'low', indicators: [`日均步数 ${stats.steps}`], recommendation: '45 岁起 FIT 或肠镜筛查', evidenceLevel: 'A' },
      ],
    },
    {
      id: 'cancer', name: '癌症专项筛查', riskLevel: 'low',
      score: Math.min(35, 12 + (lowActivity ? 8 : 0)),
      description: '结合真实行为数据的高发癌种风险初筛（需影像/病理确诊）。',
      items: [
        { name: '胃癌', risk: lowSleep ? 20 : 12, level: lowSleep ? 'moderate' : 'low', indicators: [`睡眠 ${stats.sleepHours ?? '—'}h`], recommendation: '消化不适持续请胃镜检查', evidenceLevel: 'B' },
        { name: '肝癌', risk: 10, level: 'low', indicators: ['活动代谢来自真实记录'], recommendation: '高危人群 AFP + 超声', evidenceLevel: 'B' },
      ],
    },
    {
      id: 'chronic', name: '慢性病风险',
      riskLevel: hrElevated || lowActivity ? 'moderate' : 'low',
      score: Math.min(50, (hrElevated ? 30 : 15) + (lowActivity ? 10 : 0)),
      description: '真实 wearable 数据驱动的慢病趋势分析。',
      items: [
        { name: '高血压', risk: hrElevated ? 35 : 18, level: hrElevated ? 'moderate' : 'low', indicators: [`静息心率 ${stats.restingHR ?? '—'} bpm`], recommendation: '建议动态血压监测', evidenceLevel: 'A' },
        { name: '2 型糖尿病', risk: lowActivity ? 25 : 12, level: lowActivity ? 'moderate' : 'low', indicators: [`步数 ${stats.steps}`], recommendation: '活动不足者查空腹血糖', evidenceLevel: 'A' },
        { name: '睡眠呼吸暂停', risk: lowSpo2 || lowSleep ? 24 : 14, level: lowSpo2 ? 'moderate' : 'low', indicators: [`SpO2 ${stats.spo2 ?? '—'}%`, `睡眠 ${stats.sleepHours ?? '—'}h`], recommendation: '打鼾或低氧做多导睡眠监测', evidenceLevel: 'B' },
      ],
    },
    {
      id: 'cardio', name: '心脑血管事件', riskLevel: hrElevated || lowHrv ? 'moderate' : 'low',
      score: Math.min(45, 14 + (lowHrv ? 15 : 0)),
      description: '真实 HRV、静息心率评估心血管事件风险。',
      items: [
        { name: '冠心病/心梗', risk: hrElevated ? 28 : 12, level: hrElevated ? 'moderate' : 'low', indicators: [`HR ${stats.heartRate}`, `HRV ${stats.hrv}`], recommendation: '持续异常请心内科评估', evidenceLevel: 'A' },
        { name: '心律失常', risk: lowHrv ? 26 : 11, level: lowHrv ? 'moderate' : 'low', indicators: [`HRV ${stats.hrv ?? '—'} ms`], recommendation: '佩戴 ECG 持续监测', evidenceLevel: 'B' },
      ],
    },
    {
      id: 'common', name: '常见小病 · 早期预警',
      riskLevel: recentActivityDrop ? 'moderate' : 'low',
      score: Math.min(45, 18 + (recentActivityDrop ? 15 : 0)),
      description: '活动骤降、HRV 波动等提示感冒、流感等急性病倾向（非诊断）。',
      items: [
        { name: '普通感冒', risk: recentActivityDrop ? 32 : 16, level: recentActivityDrop ? 'moderate' : 'low', indicators: [`今日步数 ${stats.steps}`, recentActivityDrop ? '活动量明显下降' : '活动正常'], recommendation: '休息补水，3 天未缓解就医', evidenceLevel: 'C' },
        { name: '流行性感冒', risk: recentActivityDrop && lowHrv ? 30 : 14, level: recentActivityDrop ? 'moderate' : 'low', indicators: [`HRV ${stats.hrv ?? '—'}`], recommendation: '高热肌肉酸痛请发热门诊', evidenceLevel: 'B' },
        { name: '急性上呼吸道感染', risk: lowSpo2 ? 28 : 18, level: lowSpo2 ? 'moderate' : 'low', indicators: [`血氧 ${stats.spo2 ?? '—'}%`], recommendation: '血氧下降请呼吸科评估', evidenceLevel: 'B' },
        { name: '病毒性发热倾向', risk: hrElevated && recentActivityDrop ? 35 : 15, level: hrElevated && recentActivityDrop ? 'moderate' : 'low', indicators: [`静息 HR ${stats.restingHR}`], recommendation: '发热伴气促立即就医', evidenceLevel: 'C' },
      ],
    },
    {
      id: 'respiratory', name: '呼吸系统筛查', riskLevel: lowSpo2 ? 'moderate' : 'low',
      score: Math.min(40, 16 + (lowSpo2 ? 18 : 0)),
      description: '真实血氧与活动耐量评估呼吸系统风险。',
      items: [
        { name: '社区获得性肺炎', risk: lowSpo2 ? 30 : 12, level: lowSpo2 ? 'moderate' : 'low', indicators: [`SpO2 ${stats.spo2 ?? '—'}%`], recommendation: '咳嗽发热胸痛请胸片', evidenceLevel: 'B' },
        { name: '支气管哮喘', risk: lowSpo2 ? 25 : 18, level: lowSpo2 ? 'moderate' : 'low', indicators: ['呼吸相关 wearable 指标'], recommendation: '喘息发作查肺功能', evidenceLevel: 'B' },
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
  buildRealScreeningCategories,
  buildRealTrendData,
};
