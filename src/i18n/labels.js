/**
 * Bilingual label maps keyed by the Chinese source string.
 */

/** Navigation section labels + item texts. */
export const NAV_EN = {
  '干预路径': 'Intervention Pathway',
  '论文核心': 'Thesis Core',
  '数据管理': 'Data Management',
  '早筛与干预': 'Early Screening & Intervention',
  '信号与预测': 'Signals & Prediction',
  '队列与结局': 'Cohort & Outcomes',
  '研究评价': 'Research & Evaluation',
  '临床验证': 'Clinical Validation',
  '系统': 'System',
  '临床筛查': 'Clinical Screening',
  '临床筛查中心': 'Clinical Screening',
  '异常检测': 'Anomaly Detection',
  'AI 干预': 'AI Intervention',
  '预测分析': 'Predictive Analytics',
  '医生报告': 'Doctor Report',
  '医生接诊报告': 'Doctor Report',
  '预约体检': 'Exam Booking',
  '研究评价中心': 'Research & Evaluation',
  '结局对比': 'Outcome Comparison',
  '患者队列': 'Patient Cohort',
  '患者管理': 'Patient Management',
  '方法学文档': 'Methodology',
  '系统设置': 'Settings',
  '数据导入': 'Data Import',
};

/** Common UI terms reused across pages. */
export const COMMON_EN = {
  '刷新': 'Refresh',
  '保存': 'Save',
  '保存设置': 'Save Settings',
  '运行': 'Run',
  '关闭': 'Close',
  '重试': 'Retry',
  '成功': 'Success',
  '失败': 'Failed',
  '演示数据': 'Demo data',
  '真实数据': 'Real data',
  '下一步': 'Next',
};

export function enLabel(zh) {
  return NAV_EN[zh] ?? COMMON_EN[zh];
}
