/**
 * Platform framing constants — early screening & intervention is the default
 * system narrative (formerly "paper demo mode", now integrated into main nav).
 */

/** Thesis title shown on research / outcomes pages. */
export const PAPER_TITLE = '基于消费级可穿戴代理信号的慢病与肿瘤早筛预测框架：干预路径模拟与筛查效果评估';
export const PAPER_TITLE_EN = 'Early Prediction and Screening for Chronic Disease and Cancer Using Consumer Wearable Proxy Signals: Intervention Pathway Simulation and Comparative Outcome Evaluation';

/**
 * Consumer-grade wearable proxy signals used for early screening.
 */
export const PROXY_SIGNALS = [
  { key: 'hr', label: '心率 (HR)', proxy: '交感激活 / 发热代理', unit: 'bpm' },
  { key: 'hrv', label: '心率变异 (HRV)', proxy: '自主神经应激代理', unit: 'ms' },
  { key: 'spo2', label: '血氧 (SpO₂)', proxy: '呼吸道受累代理', unit: '%' },
  { key: 'steps', label: '步数 (steps)', proxy: '活动度 / 病休代理', unit: 'steps' },
];

/** Curated one-click demo screening scenarios. */
export const PAPER_DEMO_SCENARIOS = [
  { id: 'SC-001', group: '肿瘤早筛', label: '结直肠癌 · 活动下降+血压趋势' },
  { id: 'SC-002', group: '癌症专项', label: '乳腺癌 · 睡眠/活动模式异常' },
  { id: 'SC-003', group: '慢病风险', label: '高血压 · 静息心率升高' },
  { id: 'SC-004', group: '肿瘤早筛', label: '肺癌 · SpO₂ 趋势 + 吸烟史' },
  { id: 'SC-005', group: '对照组', label: '无早筛 · 症状出现后就诊' },
];

/** Default landing route after login. */
export function getHomePath() {
  return '/screening';
}
