/** 预测分析项目库 */

function getDemoPredictions() {
  return [
    {
      id: 1, category: 'training', categoryLabel: '运动恢复', categoryLabel_en: 'Training & recovery',
      risk: '过度训练风险', risk_en: 'Overtraining risk',
      probability: 22, timeframe: '7天内', timeframe_en: 'Within 7 days', horizon: 'short',
      factors: ['连续3天高强度', 'HRV 下降趋势'], factors_en: ['3 consecutive high-intensity days', 'Declining HRV trend'],
      recommendation: '建议安排 1-2 天恢复性训练或休息', recommendation_en: 'Schedule 1–2 recovery or rest days',
      level: 'low', model: 'RecoveryNet-v2',
    },
    {
      id: 2, category: 'sleep', categoryLabel: '睡眠健康', categoryLabel_en: 'Sleep health',
      risk: '睡眠质量下降', risk_en: 'Declining sleep quality',
      probability: 35, timeframe: '3天内', timeframe_en: 'Within 3 days', horizon: 'short',
      factors: ['入睡时间推迟', '屏幕使用时间增加'], factors_en: ['Later sleep onset', 'Increased screen time'],
      recommendation: '建议 22:30 前放下电子设备', recommendation_en: 'Put devices away before 22:30',
      level: 'medium', model: 'SleepAI-v2',
    },
    {
      id: 3, category: 'cardio', categoryLabel: '心血管', categoryLabel_en: 'Cardiovascular',
      risk: '静息心率上升趋势', risk_en: 'Rising resting heart rate',
      probability: 28, timeframe: '14天内', timeframe_en: 'Within 14 days', horizon: 'medium',
      factors: ['近7天 RHR 上升 4 bpm', '压力指数略升'], factors_en: ['RHR up 4 bpm over 7 days', 'Slightly elevated stress index'],
      recommendation: '减少咖啡因，增加睡眠，必要时查动态血压', recommendation_en: 'Reduce caffeine, improve sleep; consider ambulatory BP if needed',
      level: 'low', model: 'MedWear-RuleEngine-v1',
    },
    {
      id: 4, category: 'metabolic', categoryLabel: '代谢', categoryLabel_en: 'Metabolic',
      risk: '糖代谢异常倾向', risk_en: 'Early glycemic dysregulation',
      probability: 18, timeframe: '90天内', timeframe_en: 'Within 90 days', horizon: 'long',
      factors: ['BMI 正常但活动波动', '餐后心率偶升'], factors_en: ['Normal BMI but variable activity', 'Occasional post-meal HR rise'],
      recommendation: '年度空腹血糖 + HbA1c，控制精制碳水', recommendation_en: 'Annual fasting glucose + HbA1c; limit refined carbs',
      level: 'low', model: 'GlucoPredict-v2',
    },
    {
      id: 5, category: 'infection', categoryLabel: '感染/急性病', categoryLabel_en: 'Infection / acute illness',
      risk: '季节性感冒/流感暴露', risk_en: 'Seasonal cold/flu exposure',
      probability: 24, timeframe: '14天内', timeframe_en: 'Within 14 days', horizon: 'medium',
      factors: ['换季期间', 'HRV 轻微波动', '睡眠略减'], factors_en: ['Season change', 'Mild HRV fluctuation', 'Slightly reduced sleep'],
      recommendation: '注意保暖，建议接种流感疫苗', recommendation_en: 'Stay warm; consider influenza vaccination',
      level: 'low', model: 'InfectGuard-v1',
    },
    {
      id: 6, category: 'respiratory', categoryLabel: '呼吸系统', categoryLabel_en: 'Respiratory',
      risk: '夜间低氧事件增加', risk_en: 'More nocturnal hypoxemia events',
      probability: 16, timeframe: '30天内', timeframe_en: 'Within 30 days', horizon: 'medium',
      factors: ['睡眠效率略降', 'BMI 正常'], factors_en: ['Slightly lower sleep efficiency', 'Normal BMI'],
      recommendation: '侧卧睡眠，打鼾明显者做睡眠监测', recommendation_en: 'Side sleeping; sleep study if snoring is prominent',
      level: 'low', model: 'RespiraAI-v1',
    },
    {
      id: 7, category: 'mental', categoryLabel: '心理/压力', categoryLabel_en: 'Stress & mental health',
      risk: '慢性压力累积', risk_en: 'Chronic stress accumulation',
      probability: 31, timeframe: '21天内', timeframe_en: 'Within 21 days', horizon: 'medium',
      factors: ['HRV 低于个人基线', '深睡占比下降'], factors_en: ['HRV below personal baseline', 'Reduced deep-sleep share'],
      recommendation: '正念冥想 10 分钟/天，适度有氧运动', recommendation_en: '10 min/day mindfulness; moderate aerobic exercise',
      level: 'medium', model: 'StressMap-v2',
    },
    {
      id: 8, category: 'seasonal', categoryLabel: '季节健康', categoryLabel_en: 'Seasonal health',
      risk: '过敏高发期症状', risk_en: 'Allergy-season symptoms',
      probability: 26, timeframe: '30天内', timeframe_en: 'Within 30 days', horizon: 'medium',
      factors: ['春季花粉期', '睡眠轻度受影响'], factors_en: ['Spring pollen season', 'Mild sleep impact'],
      recommendation: '外出佩戴口罩，室内空气净化', recommendation_en: 'Wear a mask outdoors; use indoor air purification',
      level: 'low', model: 'SeasonHealth-v1',
    },
    {
      id: 9, category: 'cardio', categoryLabel: '心血管', categoryLabel_en: 'Cardiovascular',
      risk: '血压波动加大', risk_en: 'Increased BP variability',
      probability: 33, timeframe: '7天内', timeframe_en: 'Within 7 days', horizon: 'short',
      factors: ['收缩压偶超 125', '盐摄入可能偏高'], factors_en: ['Occasional SBP >125', 'Possibly high salt intake'],
      recommendation: '低盐饮食，每日自测血压记录', recommendation_en: 'Low-sodium diet; daily home BP log',
      level: 'medium', model: 'BP-TrendNet v3.1',
    },
    {
      id: 10, category: 'metabolic', categoryLabel: '代谢', categoryLabel_en: 'Metabolic',
      risk: '体重缓慢上升', risk_en: 'Gradual weight gain',
      probability: 20, timeframe: '60天内', timeframe_en: 'Within 60 days', horizon: 'long',
      factors: ['活动量周末偏低', '热量摄入可能超标'], factors_en: ['Lower weekend activity', 'Possible caloric surplus'],
      recommendation: '维持步数 8000+，每周称重记录', recommendation_en: 'Maintain 8,000+ steps; weekly weigh-ins',
      level: 'low', model: 'MetaboTrack-v1',
    },
  ];
}

const CATEGORY_META = {
  training: { label: '运动恢复', label_en: 'Training & recovery', color: '#1565C0' },
  sleep: { label: '睡眠健康', label_en: 'Sleep health', color: '#6A1B9A' },
  cardio: { label: '心血管', label_en: 'Cardiovascular', color: '#C62828' },
  metabolic: { label: '代谢', label_en: 'Metabolic', color: '#EF6C00' },
  infection: { label: '感染/急性病', label_en: 'Infection / acute illness', color: '#00838F' },
  respiratory: { label: '呼吸系统', label_en: 'Respiratory', color: '#0277BD' },
  mental: { label: '心理/压力', label_en: 'Stress & mental health', color: '#7B1FA2' },
  seasonal: { label: '季节健康', label_en: 'Seasonal health', color: '#2E7D32' },
};

module.exports = { getDemoPredictions, CATEGORY_META };
