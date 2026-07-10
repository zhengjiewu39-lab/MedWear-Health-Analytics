/**
 * Thesis intervention pathway — AI-oriented with human-in-the-loop control.
 * 临床筛查 → 异常检测 → 预测分析 → AI干预 → 医生报告 → 预约体检 → 研究评价 → 结局对比
 */

export const PATHWAY_STEPS = [
  { id: 'screening', text: '临床筛查', text_en: 'Clinical Screening', path: '/screening', step: 1, actor: 'ai' },
  { id: 'anomaly', text: '异常检测', text_en: 'Anomaly Detection', path: '/ai/anomaly', step: 2, actor: 'ai' },
  { id: 'predictive', text: '预测分析', text_en: 'Predictive Analytics', path: '/ai/predictive', step: 3, actor: 'ai' },
  { id: 'ai-intervention', text: 'AI 干预', text_en: 'AI Intervention', path: '/ai/intervention', step: 4, actor: 'ai-human' },
  { id: 'ai-chat', text: 'AI 临床助手', text_en: 'Clinical AI', path: '/ai/chat', step: 4.5, actor: 'physician' },
  { id: 'doctor-report', text: '医生报告', text_en: 'Doctor Report', path: '/doctor-report', step: 5, actor: 'physician' },
  { id: 'appointments', text: '预约体检', text_en: 'Exam Booking', path: '/appointments', step: 6, actor: 'physician' },
  { id: 'research', text: '研究评价', text_en: 'Research & Evaluation', path: '/research', step: 7, actor: 'admin' },
];

export const OUTCOMES_STEP = {
  id: 'outcomes',
  text: '结局对比',
  text_en: 'Outcome Comparison',
  path: '/outcomes',
  step: 8,
  actor: 'admin',
};

export function getPathwayStep(pathname) {
  const all = [...PATHWAY_STEPS, OUTCOMES_STEP];
  return all.find((s) => s.path === pathname) || null;
}

export function getNextStep(pathname) {
  const all = [...PATHWAY_STEPS, OUTCOMES_STEP];
  const idx = all.findIndex((s) => s.path === pathname);
  return idx >= 0 && idx < all.length - 1 ? all[idx + 1] : null;
}

export function getPrevStep(pathname) {
  const all = [...PATHWAY_STEPS, OUTCOMES_STEP];
  const idx = all.findIndex((s) => s.path === pathname);
  return idx > 0 ? all[idx - 1] : null;
}
