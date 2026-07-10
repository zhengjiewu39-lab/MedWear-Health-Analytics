/**
 * 符合正常成人体生理标准的模拟数据
 * 参考: WHO、AHA、中国成人体格标准
 * 模拟对象: 35岁男性, Apple Watch Series 9
 */
const { getExtendedCategories, getDemoTrendData, getRecommendedExams, getRecommendedExamsEn } = require('../data/screeningCatalog');
const { getDemoFacilities } = require('../data/medicalFacilities');
const { getDemoPredictions } = require('../data/predictionsCatalog');

const PROFILE = {
  name: '陈志远',
  age: 35,
  gender: '男',
  height: 175,
  weight: 70,
  bmi: 22.9,
  device: 'Apple Watch Series 9',
};

// 正常参考范围
const STANDARDS = {
  heartRate: { min: 60, max: 100, rest: { min: 60, max: 80 }, unit: 'bpm', label: '心率' },
  spo2: { min: 95, max: 100, unit: '%', label: '血氧饱和度' },
  bloodPressure: { systolic: { min: 90, max: 120 }, diastolic: { min: 60, max: 80 }, unit: 'mmHg' },
  temperature: { min: 36.1, max: 37.2, unit: '°C', label: '体温' },
  hrv: { min: 20, max: 70, good: 40, unit: 'ms', label: 'HRV' },
  glucose: { min: 3.9, max: 6.1, unit: 'mmol/L', label: '空腹血糖' },
  respiratory: { min: 12, max: 20, unit: '次/分', label: '呼吸率' },
  steps: { target: 8000, unit: '步' },
  sleep: { min: 7, max: 9, unit: '小时' },
  activeEnergy: { target: 500, unit: 'kcal' },
};

function genHR(hour) {
  // 昼夜节律: 凌晨低, 白天高, 傍晚运动峰值
  const base = 62;
  if (hour >= 0 && hour < 6) return base - 4 + Math.random() * 4;
  if (hour >= 6 && hour < 9) return base + 8 + Math.random() * 10;
  if (hour >= 12 && hour < 14) return base + 5 + Math.random() * 8;
  if (hour >= 17 && hour < 19) return base + 25 + Math.random() * 20; // 运动
  return base + Math.random() * 12;
}

function todayVitalsTrend() {
  return Array.from({ length: 24 }, (_, h) => ({
    time: `${String(h).padStart(2, '0')}:00`,
    heartRate: Math.round(genHR(h)),
    bloodOxygen: Math.round(96 + Math.random() * 3),
    hrv: Math.round(42 + Math.random() * 18),
    steps: h < 7 ? 0 : Math.round((h - 6) * 580 + Math.random() * 200),
  }));
}

function weekTrend() {
  const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  return days.map((day, i) => ({
    day,
    heartRate: Math.round(68 + Math.sin(i) * 5 + Math.random() * 4),
    spo2: +(97 + Math.random() * 2).toFixed(1),
    steps: Math.round(7200 + i * 300 + Math.random() * 1500),
    sleep: +(7.2 + Math.random() * 0.8).toFixed(1),
    hrv: Math.round(48 + Math.random() * 12),
    score: Math.round(75 + Math.random() * 15),
  }));
}

function monthHealthScore() {
  return ['1月', '2月', '3月', '4月', '5月', '6月'].map((m, i) => ({
    month: m,
    score: Math.round(72 + i * 1.2 + Math.random() * 4),
    activity: Math.round(70 + i * 2),
    sleep: Math.round(75 + Math.random() * 10),
    cardio: Math.round(78 + i * 1.5),
  }));
}

const mockData = {
  profile: PROFILE,
  standards: STANDARDS,

  dashboard: {
    stats: {
      healthScore: 82,
      healthGrade: 'B+',
      heartRate: 72,
      restingHR: 64,
      spo2: 98,
      hrv: 52,
      steps: 8432,
      stepsTarget: 8000,
      sleepHours: 7.4,
      activeCalories: 486,
      activeCaloriesTarget: 500,
      standHours: 10,
      exerciseMinutes: 38,
      stressLevel: '低',
      recoveryScore: 78,
      dataQuality: 96,
    },
    vitalsTrend: todayVitalsTrend(),
    weekTrend: weekTrend(),
    healthScoreTrend: monthHealthScore(),
    heartRateZones: [
      { zone: '静息', range: '< 100', percent: 78, color: '#4CAF50' },
      { zone: '脂肪燃烧', range: '100-120', percent: 12, color: '#2196F3' },
      { zone: '有氧', range: '120-140', percent: 7, color: '#FF9800' },
      { zone: '无氧', range: '140-160', percent: 2, color: '#F44336' },
      { zone: '极限', range: '> 160', percent: 1, color: '#9C27B0' },
    ],
    organScores: [
      { name: '心血管', score: 85, status: 'good' },
      { name: '呼吸系统', score: 92, status: 'excellent' },
      { name: '睡眠质量', score: 78, status: 'good' },
      { name: '运动恢复', score: 74, status: 'good' },
      { name: '代谢健康', score: 80, status: 'good' },
      { name: '压力水平', score: 68, status: 'moderate' },
    ],
    aiInsights: [
      { type: 'positive', text: '静息心率 64 bpm，处于优秀范围（正常 60-80），心血管功能良好' },
      { type: 'positive', text: '血氧饱和度 98%，高于 WHO 建议的 95% 最低标准' },
      { type: 'warning', text: 'HRV 52ms 略低于本周均值 55ms，建议增加恢复性休息' },
      { type: 'info', text: '今日步数 8432 步，已达成 WHO 推荐的 8000 步目标' },
      { type: 'info', text: '深睡占比 22%，接近理想值 25%，作息规律有助于提升' },
    ],
    recentAlerts: [
      { id: 1, type: 'HRV 偏低', severity: 'low', message: 'HRV 较7日均值下降 8%，可能与睡眠不足有关', time: '09:30' },
      { id: 2, type: '运动达标', severity: 'info', message: '今日运动时长 38 分钟，达成 WHO 建议的 30 分钟', time: '18:45' },
    ],
  },

  vitals: {
    heartRate: { value: 72, resting: 64, max: 142, unit: 'bpm', trend: 'stable', history: [68, 70, 71, 69, 72, 74, 73, 72] },
    bloodOxygen: { value: 98, unit: '%', trend: 'stable', history: [97, 98, 98, 97, 98, 99, 98, 98] },
    bloodPressure: { systolic: 118, diastolic: 76, unit: 'mmHg', trend: 'normal' },
    temperature: { value: 36.5, unit: '°C', trend: 'normal' },
    glucose: { value: 5.2, unit: 'mmol/L', trend: 'normal' },
    hrv: { value: 52, baseline: 55, unit: 'ms', trend: 'slightly_low', history: [48, 50, 52, 51, 53, 52, 54, 52] },
    respiratory: { value: 16, unit: '次/分', trend: 'normal' },
    steps: { value: 8432, target: 8000, unit: '步' },
    calories: { value: 486, target: 500, unit: 'kcal' },
    standHours: { value: 10, target: 12, unit: '小时' },
    exerciseMinutes: { value: 38, target: 30, unit: '分钟' },
  },

  sleep: {
    overview: { totalSleep: 7.4, deepSleep: 1.6, remSleep: 1.8, lightSleep: 4.0, awake: 0.3, sleepScore: 84, efficiency: 91 },
    stages: [
      { time: '22:30', deep: 5, light: 30, rem: 0, awake: 10 },
      { time: '23:30', deep: 40, light: 25, rem: 5, awake: 0 },
      { time: '00:30', deep: 45, light: 15, rem: 10, awake: 0 },
      { time: '01:30', deep: 35, light: 20, rem: 20, awake: 0 },
      { time: '02:30', deep: 25, light: 25, rem: 25, awake: 0 },
      { time: '03:30', deep: 15, light: 30, rem: 30, awake: 5 },
      { time: '04:30', deep: 10, light: 20, rem: 25, awake: 5 },
      { time: '05:30', deep: 5, light: 15, rem: 15, awake: 15 },
      { time: '06:30', deep: 0, light: 10, rem: 5, awake: 30 },
    ],
    weekSleep: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map(d => ({
      day: d, total: +(7 + Math.random() * 1.5).toFixed(1), deep: +(1.4 + Math.random() * 0.6).toFixed(1), score: Math.round(78 + Math.random() * 15),
    })),
    aiInsights: [
      '总睡眠 7.4 小时，符合成人 7-9 小时推荐标准',
      '深睡 1.6 小时（占比 22%），接近理想值 20-25%',
      'REM 睡眠 1.8 小时充足，有助于记忆巩固',
      '睡眠效率 91%，属于优秀水平（>85% 为良好）',
      '建议保持 22:30-23:00 入睡，当前作息规律',
    ],
  },

  recovery: {
    score: 78,
    stress: { level: '低', value: 28, history: [32, 30, 28, 35, 26, 28, 25] },
    hrvTrend: [48, 52, 55, 50, 53, 51, 52].map((v, i) => ({ day: ['一', '二', '三', '四', '五', '六', '日'][i], hrv: v, baseline: 55 })),
    readiness: { score: 82, recommendation: '适合中等强度训练', factors: ['睡眠充足', 'HRV 正常', '静息心率稳定'] },
    bodyBattery: [
      { time: '06:00', level: 85 }, { time: '09:00', level: 72 }, { time: '12:00', level: 58 },
      { time: '15:00', level: 45 }, { time: '18:00', level: 38 }, { time: '21:00', level: 55 },
    ],
  },

  anomalies: [
    { id: 1, type: 'HRV 短暂下降', type_en: 'Transient HRV drop', confidence: 82, detectedAt: '2024-06-25 23:00', pattern: 'HRV 降至 38ms，低于个人基线 30%', pattern_en: 'HRV fell to 38 ms, 30% below personal baseline', aiModel: 'VitalGuard-v2', status: 'resolved', severity: 'low' },
    { id: 2, type: '运动后心率恢复偏慢', type_en: 'Slow post-exercise heart rate recovery', confidence: 76, detectedAt: '2024-06-24 18:30', pattern: '运动后 5 分钟心率仍 > 100 bpm', pattern_en: 'Heart rate still > 100 bpm 5 minutes after exercise', aiModel: 'CardioNet-v3', status: 'monitoring', severity: 'medium' },
  ],

  predictions: getDemoPredictions(),

  digitalTwin: {
    patient: PROFILE.name,
    age: PROFILE.age,
    organs: [
      { name: '心脏', status: 'normal', score: 85, metrics: { 静息心率: '64 bpm', HRV: '52 ms', 心律: '窦性' } },
      { name: '肺部', status: 'normal', score: 92, metrics: { 血氧: '98%', 呼吸率: '16/min' } },
      { name: '代谢', status: 'normal', score: 80, metrics: { 血糖: '5.2 mmol/L', BMI: '22.9' } },
      { name: '睡眠', status: 'normal', score: 84, metrics: { 时长: '7.4h', 效率: '91%' } },
      { name: '活动', status: 'normal', score: 79, metrics: { 步数: '8432', 消耗: '486 kcal' } },
      { name: '压力', status: 'normal', score: 72, metrics: { 等级: '低', 恢复: '78分' } },
    ],
    overallScore: 82,
  },

  fusionSources: [
    { device: 'Apple Watch S9', metrics: ['心率', '血氧', 'HRV', '步数', '睡眠'], metrics_en: ['Heart rate', 'SpO₂', 'HRV', 'Steps', 'Sleep'], weight: 0.55, quality: 97 },
    { device: 'iPhone 15 Pro', metrics: ['步数', '距离', '爬楼'], metrics_en: ['Steps', 'Distance', 'Floors climbed'], weight: 0.25, quality: 94 },
    { device: 'Withings 体脂秤', metrics: ['体重', 'BMI', '体脂率'], metrics_en: ['Weight', 'BMI', 'Body-fat %'], weight: 0.20, quality: 96 },
  ],

  healthGoals: [
    { id: 1, title: '每日步数', type: 'steps', current: 8432, target: 8000, unit: '步', progress: 100, points: 50 },
    { id: 2, title: '睡眠时长', type: 'sleep', current: 7.4, target: 8, unit: '小时', progress: 93, points: 30 },
    { id: 3, title: '静息心率', type: 'heartRate', current: 64, target: 65, unit: 'bpm', progress: 98, points: 40 },
    { id: 4, title: '血氧达标', type: 'spo2', current: 98, target: 95, unit: '%', progress: 100, points: 20 },
    { id: 5, title: '运动时长', type: 'exercise', current: 38, target: 30, unit: '分钟', progress: 100, points: 35 },
  ],

  alerts: [
    { id: 1, type: 'HRV 偏低', type_en: 'Low HRV', severity: 'low', message: 'HRV 52ms 略低于个人基线，建议充分休息', message_en: 'HRV 52 ms is slightly below personal baseline; adequate rest is advised', time: '2024-06-26 09:30', status: 'acknowledged', device: 'Apple Watch S9' },
    { id: 2, type: '运动目标达成', type_en: 'Exercise goal achieved', severity: 'info', message: '今日运动 38 分钟，超过 WHO 建议的 30 分钟', message_en: "Today's exercise of 38 minutes exceeds the WHO-recommended 30 minutes", time: '2024-06-26 18:45', status: 'resolved', device: 'Apple Watch S9' },
  ],

  aiReport: {
    generatedAt: new Date().toISOString(),
    summary: '整体健康状况良好，各项指标均在正常成人参考范围内。',
    sections: [
      { title: '心血管评估', grade: 'A-', content: '静息心率 64 bpm（优秀），平均心率 72 bpm，血氧 98%。7天 HRV 均值 52ms，自主神经功能正常。建议保持当前有氧运动习惯。', metrics: { 静息心率: '64 bpm ✓', 血氧: '98% ✓', HRV: '52 ms ✓' } },
      { title: '睡眠评估', grade: 'B+', content: '平均睡眠 7.4 小时，效率 91%。深睡占比 22% 接近理想。入睡时间规律（22:30 左右），无明显睡眠呼吸问题。', metrics: { 总睡眠: '7.4h ✓', 深睡: '1.6h ✓', 效率: '91% ✓' } },
      { title: '活动评估', grade: 'A', content: '日均步数 8432 步，达成 WHO 8000 步标准。周运动 5 天，每次 30+ 分钟。活动卡路里 486 kcal，代谢活跃。', metrics: { 步数: '8432 ✓', 运动: '38 min ✓', 卡路里: '486 kcal ✓' } },
      { title: '风险预警', grade: 'B', content: '检测到 HRV 轻微下降趋势（-8%），可能与近期训练负荷增加有关。无重大健康风险。建议关注恢复指标。', metrics: { 过度训练: '22% 低', 睡眠下降: '35% 中' } },
    ],
    recommendations: [
      '保持每周 150 分钟中等强度有氧运动（当前已达标）',
      '增加 1-2 次恢复性训练（瑜伽/散步）以提升 HRV',
      '维持 22:30 规律入睡，目标深睡占比提升至 25%',
      '每季度复查血压和空腹血糖',
    ],
  },

  devices: [
    { id: 1, name: 'Apple Watch Series 9', type: '智能手表', status: 'online', battery: 78, lastSync: '刚刚', metrics: ['心率', '血氧', 'ECG', 'HRV', '步数', '睡眠'] },
    { id: 2, name: 'iPhone 15 Pro', type: '手机', status: 'online', battery: 65, lastSync: '刚刚', metrics: ['步数', '距离'] },
    { id: 3, name: 'Withings Body+', type: '智能体脂秤', status: 'online', battery: 100, lastSync: '今天 07:00', metrics: ['体重', 'BMI', '体脂率'] },
  ],

  // 肿瘤 / 慢性病 AI 筛查（可穿戴 + 临床指标融合）
  diseaseScreening: {
    generatedAt: new Date().toISOString(),
    overallRisk: 'low',
    overallScore: 18,
    summary: '基于 90 天可穿戴连续监测数据与临床参考指标，覆盖肿瘤、癌症专项、慢性病、心脑血管、常见小病及呼吸系统六大类筛查，当前整体风险偏低。建议关注血压趋势，并按年龄规律安排专项体检。',
    summary_en: 'Based on 90 days of continuous wearable monitoring data and clinical reference indicators, covering six screening categories — tumor, cancer-specific, chronic disease, cardio-cerebrovascular, common ailments, and respiratory — overall risk is currently low. Monitoring of blood pressure trends and age-appropriate specialty checkups are advised.',
    dataCoverage: { days: 90, samples: 128400, devices: 3, quality: 96 },
    categories: getExtendedCategories(),
    biomarkers: [
      { name: '静息心率', name_en: 'Resting heart rate', value: 64, unit: 'bpm', ref: '60-80', status: 'normal', source: 'Apple Watch', source_en: 'Apple Watch' },
      { name: '血氧饱和度', name_en: 'Blood oxygen saturation', value: 98, unit: '%', ref: '95-100', status: 'normal', source: 'Apple Watch', source_en: 'Apple Watch' },
      { name: 'HRV (RMSSD)', name_en: 'HRV (RMSSD)', value: 52, unit: 'ms', ref: '20-70', status: 'normal', source: 'Apple Watch', source_en: 'Apple Watch' },
      { name: '收缩压/舒张压', name_en: 'Systolic/Diastolic pressure', value: '118/76', unit: 'mmHg', ref: '90-120/60-80', status: 'normal', source: '手动录入', source_en: 'Manual entry' },
      { name: '空腹血糖', name_en: 'Fasting glucose', value: 5.2, unit: 'mmol/L', ref: '3.9-6.1', status: 'normal', source: '体检记录', source_en: 'Checkup record' },
      { name: 'BMI', name_en: 'BMI', value: 22.9, unit: '', ref: '18.5-24', status: 'normal', source: '体脂秤', source_en: 'Body-fat scale' },
      { name: '30天活动量', name_en: '30-day activity', value: 8432, unit: '步/日', ref: '≥8000', status: 'normal', source: '多设备融合', source_en: 'Multi-device fusion' },
      { name: '平均睡眠', name_en: 'Average sleep', value: 7.4, unit: '小时', ref: '7-9', status: 'normal', source: 'Apple Watch', source_en: 'Apple Watch' },
    ],
    trendData: getDemoTrendData(),
    aiInsights: [
      { type: 'warning', text: '近 30 天收缩压均值略超理想上限（122 mmHg），建议预约体检复查动态血压', text_en: 'Mean systolic pressure over the past 30 days slightly exceeds the ideal upper limit (122 mmHg); booking a checkup for ambulatory blood pressure re-evaluation is advised' },
      { type: 'positive', text: '肿瘤与癌症专项间接指标均处于同龄低风险区间', text_en: 'Indirect indicators for tumor and cancer-specific screening are all within the low-risk range for the same age group' },
      { type: 'info', text: '常见小病预警：当前无活动骤降或血氧异常，感冒/流感风险低', text_en: 'Common ailment alert: no activity drop or SpO₂ abnormality at present; cold/flu risk is low' },
      { type: 'info', text: '可穿戴数据覆盖率 96%，足够支撑 AI 全品类筛查分析', text_en: 'Wearable data coverage is 96%, sufficient to support AI screening analysis across all categories' },
    ],
    recommendedExams: getRecommendedExams(),
    recommendedExams_en: getRecommendedExamsEn(),
  },

  hospitals: getDemoFacilities(),

  examPackages: [
    { id: 1, name: '肿瘤早筛专项套餐', category: 'tumor', price: 2680, duration: '半天', items: ['低剂量胸部 CT', '肿瘤标志物 12 项', '甲状腺 B 超', '腹部 B 超', 'AFP'], suitable: '40岁以上或有肿瘤家族史', includesWearableReport: true },
    { id: 2, name: '癌症专项筛查套餐', category: 'cancer', price: 3280, duration: '1天', items: ['乳腺/前列腺筛查', '胃镜', '肠镜', 'HPV/TCT', '肿瘤标志物扩展'], suitable: '高发癌种专项筛查', includesWearableReport: true },
    { id: 3, name: '慢病筛查标准套餐', category: 'chronic', price: 1280, duration: '2小时', items: ['24h 动态血压', '空腹血糖+HbA1c', '血脂四项', '肝肾功能', '尿常规', '心电图'], suitable: '血压/血糖趋势异常者', includesWearableReport: true },
    { id: 4, name: '心脑血管深度筛查', category: 'cardio', price: 1980, duration: '3小时', items: ['心电图', '心脏超声', '颈动脉超声', '同型半胱氨酸', '运动负荷试验（可选）'], suitable: '心血管风险中等及以上', includesWearableReport: true },
    { id: 5, name: '常见小病 · 呼吸健康套餐', category: 'common', price: 680, duration: '1.5小时', items: ['血常规', 'C反应蛋白', '胸部 X 光', '流感/新冠抗原', '过敏原 IgE'], suitable: '换季或反复感冒/过敏者', includesWearableReport: true },
    { id: 6, name: '呼吸系统专项', category: 'respiratory', price: 980, duration: '2小时', items: ['肺功能检查', '胸部 CT', 'FeNO 检测', '支气管舒张试验'], suitable: '咳嗽喘息或吸烟史', includesWearableReport: true },
    { id: 7, name: 'MedWear 数据融合全检', category: 'full', price: 3580, duration: '1天', items: ['上述全部基础项', 'MedWear 90天数据报告解读', '医生一对一问诊 15 分钟', '个性化随访计划'], suitable: '希望将可穿戴数据与体检结合者', includesWearableReport: true, highlight: true },
  ],

  appointments: [
    { id: 1001, hospitalId: 1, hospitalName: '北京协和医院', packageId: 2, packageName: '慢病筛查标准套餐', date: '2026-07-08', time: '08:30', status: 'confirmed', doctorNote: '请空腹，携带 MedWear 医生报告二维码', createdAt: '2026-06-20' },
  ],

  doctorReport: null, // built dynamically via buildDoctorReport()
};

function getLiveVitals() {
  const src = mockData.vitals;
  return {
    heartRate: { ...src.heartRate, value: 68 + Math.floor(Math.random() * 10), history: [...src.heartRate.history] },
    bloodOxygen: { ...src.bloodOxygen, value: 96 + Math.floor(Math.random() * 3), history: [...src.bloodOxygen.history] },
    hrv: { ...src.hrv, value: 48 + Math.floor(Math.random() * 12), history: [...(src.hrv.history || src.heartRate.history)] },
    temperature: { ...src.temperature },
    respiratory: { ...src.respiratory },
    bloodPressure: { ...src.bloodPressure },
    glucose: { ...src.glucose },
    steps: { ...src.steps },
    calories: { ...src.calories },
    standHours: { ...src.standHours },
    exerciseMinutes: { ...src.exerciseMinutes },
  };
}

function aiChat(message) {
  const d = mockData.dashboard.stats;
  const responses = {
    default: `【AI 健康分析】${PROFILE.name}（${PROFILE.age}岁）当前健康评分 ${d.healthScore} 分（${d.healthGrade}）。\n\n` +
      `心率 ${d.heartRate} bpm（正常 60-100）| 血氧 ${d.spo2}%（正常 ≥95%）\n` +
      `步数 ${d.steps} | 睡眠 ${d.sleepHours}h | HRV ${d.hrv}ms\n\n` +
      `整体处于正常成人健康范围，心血管和呼吸指标优秀。`,
    heart: `【心血管分析】静息心率 ${d.restingHR} bpm（优秀，正常 60-80），当前 ${d.heartRate} bpm。\n` +
      `HRV ${d.hrv}ms（正常 20-70ms），血氧 ${d.spo2}%。\n` +
      `7天心率趋势稳定，无异常波动。心血管功能评估：良好。`,
    sleep: `【睡眠分析】昨晚 ${mockData.sleep.overview.totalSleep}h（推荐 7-9h），深睡 ${mockData.sleep.overview.deepSleep}h，效率 ${mockData.sleep.overview.efficiency}%。\n` +
      mockData.sleep.aiInsights.slice(0, 3).join('\n'),
    risk: `【风险评估】\n` + mockData.predictions.map(p => `· ${p.risk}：${p.probability}%（${p.timeframe}）→ ${p.recommendation}`).join('\n'),
    recovery: `【恢复分析】恢复指数 ${mockData.recovery.score}/100，压力水平：${mockData.recovery.stress.level}。\n` +
      `训练准备度 ${mockData.recovery.readiness.score} 分 — ${mockData.recovery.readiness.recommendation}。`,
  };
  if (/心率|心脏|心血管/.test(message)) return responses.heart;
  if (/睡眠/.test(message)) return responses.sleep;
  if (/风险|预测/.test(message)) return responses.risk;
  if (/恢复|压力|HRV/.test(message)) return responses.recovery;
  return responses.default;
}

function buildDoctorReport() {
  const s = mockData.dashboard.stats;
  const scr = mockData.diseaseScreening;
  return {
    reportId: `MR-${Date.now().toString(36).toUpperCase()}`,
    generatedAt: new Date().toISOString(),
    reportType: '可穿戴融合临床筛查报告',
    reportType_en: 'Wearable-Integrated Clinical Screening Report',
    patient: {
      ...PROFILE,
      id: 'P202406001',
      phone: '138****5678',
    },
    physicianSummary: scr.summary,
    physicianSummary_en: scr.summary_en,
    overallRisk: scr.overallRisk,
    overallScore: scr.overallScore,
    vitalsSnapshot: [
      { label: '静息心率', label_en: 'Resting HR', value: s.restingHR, unit: 'bpm', ref: '60-80', flag: 'normal' },
      { label: '当前心率', label_en: 'Current HR', value: s.heartRate, unit: 'bpm', ref: '60-100', flag: 'normal' },
      { label: '血氧', label_en: 'SpO₂', value: s.spo2, unit: '%', ref: '≥95', flag: 'normal' },
      { label: 'HRV', label_en: 'HRV', value: s.hrv, unit: 'ms', ref: '20-70', flag: 'normal' },
      { label: '血压', label_en: 'Blood pressure', value: '118/76', unit: 'mmHg', ref: '90-120/60-80', flag: 'normal' },
      { label: '空腹血糖', label_en: 'Fasting glucose', value: 5.2, unit: 'mmol/L', ref: '3.9-6.1', flag: 'normal' },
      { label: 'BMI', label_en: 'BMI', value: PROFILE.bmi, unit: '', ref: '18.5-24', flag: 'normal' },
      { label: '睡眠（昨）', label_en: 'Sleep (last night)', value: s.sleepHours, unit: 'h', ref: '7-9', flag: 'normal' },
    ],
    weekTrend: mockData.dashboard.weekTrend,
    screeningHighlights: scr.categories.flatMap(c =>
      c.items.filter(i => i.level !== 'low').map(i => ({
        category: c.name,
        category_en: c.name_en,
        name: i.name,
        name_en: i.name_en,
        risk: i.risk,
        level: i.level,
        recommendation: i.recommendation,
        recommendation_en: i.recommendation_en,
      }))
    ),
    screeningSummary: scr.categories.map(c => ({
      name: c.name,
      name_en: c.name_en,
      riskLevel: c.riskLevel,
      score: c.score,
      topItems: c.items.slice(0, 2).map(i => `${i.name} ${i.risk}%`),
    })),
    biomarkers: scr.biomarkers,
    anomalies: mockData.anomalies,
    alerts: mockData.alerts.slice(0, 3),
    dataSources: mockData.fusionSources,
    recommendedExams: scr.recommendedExams,
    recommendedExams_en: scr.recommendedExams_en,
    clinicalNotes: [
      '本报告由 MedWear AI 融合 90 天可穿戴时序数据与临床参考标准自动生成',
      '肿瘤/慢病评估为风险分层模型，不能替代病理学或影像学诊断',
      '标红项建议线下体检进一步确认',
    ],
    clinicalNotes_en: [
      'This report is auto-generated by MedWear AI, integrating 90 days of wearable time-series data with clinical reference standards',
      'Tumor/chronic-disease assessments are risk-stratification models and cannot replace pathological or imaging diagnosis',
      'Items flagged in red are advised for further in-person examination',
    ],
    qrCode: 'MEDWEAR-DEMO-REPORT',
  };
}

function getExamSlots(date) {
  return ['08:00', '08:30', '09:00', '09:30', '10:00', '14:00', '14:30', '15:00'].filter((_, i) => {
    const day = new Date(date).getDay();
    if (day === 0 && i > 4) return false;
    return true;
  });
}

module.exports = {
  mockData,
  getLiveVitals,
  aiChat,
  buildDoctorReport,
  getExamSlots,
  STANDARDS,
  PROFILE,
  todayVitalsTrend,
  weekTrend,
  monthHealthScore,
};
