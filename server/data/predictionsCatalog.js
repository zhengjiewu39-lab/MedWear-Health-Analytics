/** 预测分析项目库 */

function getDemoPredictions() {
  return [
    { id: 1, category: 'training', categoryLabel: '运动恢复', risk: '过度训练风险', probability: 22, timeframe: '7天内', horizon: 'short', factors: ['连续3天高强度', 'HRV 下降趋势'], recommendation: '建议安排 1-2 天恢复性训练或休息', level: 'low', model: 'RecoveryNet-v2' },
    { id: 2, category: 'sleep', categoryLabel: '睡眠健康', risk: '睡眠质量下降', probability: 35, timeframe: '3天内', horizon: 'short', factors: ['入睡时间推迟', '屏幕使用时间增加'], recommendation: '建议 22:30 前放下电子设备', level: 'medium', model: 'SleepAI-v2' },
    { id: 3, category: 'cardio', categoryLabel: '心血管', risk: '静息心率上升趋势', probability: 28, timeframe: '14天内', horizon: 'medium', factors: ['近7天 RHR 上升 4 bpm', '压力指数略升'], recommendation: '减少咖啡因，增加睡眠，必要时查动态血压', level: 'low', model: 'CardioNet-v3' },
    { id: 4, category: 'metabolic', categoryLabel: '代谢', risk: '糖代谢异常倾向', probability: 18, timeframe: '90天内', horizon: 'long', factors: ['BMI 正常但活动波动', '餐后心率偶升'], recommendation: '年度空腹血糖 + HbA1c，控制精制碳水', level: 'low', model: 'GlucoPredict-v2' },
    { id: 5, category: 'infection', categoryLabel: '感染/急性病', risk: '季节性感冒/流感暴露', probability: 24, timeframe: '14天内', horizon: 'medium', factors: ['换季期间', 'HRV 轻微波动', '睡眠略减'], recommendation: '注意保暖，建议接种流感疫苗', level: 'low', model: 'InfectGuard-v1' },
    { id: 6, category: 'respiratory', categoryLabel: '呼吸系统', risk: '夜间低氧事件增加', probability: 16, timeframe: '30天内', horizon: 'medium', factors: ['睡眠效率略降', 'BMI 正常'], recommendation: '侧卧睡眠，打鼾明显者做睡眠监测', level: 'low', model: 'RespiraAI-v1' },
    { id: 7, category: 'mental', categoryLabel: '心理/压力', risk: '慢性压力累积', probability: 31, timeframe: '21天内', horizon: 'medium', factors: ['HRV 低于个人基线', '深睡占比下降'], recommendation: '正念冥想 10 分钟/天，适度有氧运动', level: 'medium', model: 'StressMap-v2' },
    { id: 8, category: 'seasonal', categoryLabel: '季节健康', risk: '过敏高发期症状', probability: 26, timeframe: '30天内', horizon: 'medium', factors: ['春季花粉期', '睡眠轻度受影响'], recommendation: '外出佩戴口罩，室内空气净化', level: 'low', model: 'SeasonHealth-v1' },
    { id: 9, category: 'cardio', categoryLabel: '心血管', risk: '血压波动加大', probability: 33, timeframe: '7天内', horizon: 'short', factors: ['收缩压偶超 125', '盐摄入可能偏高'], recommendation: '低盐饮食，每日自测血压记录', level: 'medium', model: 'BP-TrendNet v3.1' },
    { id: 10, category: 'metabolic', categoryLabel: '代谢', risk: '体重缓慢上升', probability: 20, timeframe: '60天内', horizon: 'long', factors: ['活动量周末偏低', '热量摄入可能超标'], recommendation: '维持步数 8000+，每周称重记录', level: 'low', model: 'MetaboTrack-v1' },
  ];
}

const CATEGORY_META = {
  training: { label: '运动恢复', color: '#1565C0' },
  sleep: { label: '睡眠健康', color: '#6A1B9A' },
  cardio: { label: '心血管', color: '#C62828' },
  metabolic: { label: '代谢', color: '#EF6C00' },
  infection: { label: '感染/急性病', color: '#00838F' },
  respiratory: { label: '呼吸系统', color: '#0277BD' },
  mental: { label: '心理/压力', color: '#7B1FA2' },
  seasonal: { label: '季节健康', color: '#2E7D32' },
};

module.exports = { getDemoPredictions, CATEGORY_META };
