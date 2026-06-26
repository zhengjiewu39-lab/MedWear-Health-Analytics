/** 正常成人体生理参考标准 */
export const STANDARDS = {
  heartRate: { min: 60, max: 100, restMin: 60, restMax: 80, optimal: 65, unit: 'bpm', label: '心率' },
  spo2: { min: 95, max: 100, optimal: 98, unit: '%', label: '血氧' },
  bloodPressure: { sysMin: 90, sysMax: 120, diaMin: 60, diaMax: 80, unit: 'mmHg', label: '血压' },
  temperature: { min: 36.1, max: 37.2, unit: '°C', label: '体温' },
  hrv: { min: 20, max: 70, good: 40, unit: 'ms', label: 'HRV' },
  glucose: { min: 3.9, max: 6.1, unit: 'mmol/L', label: '血糖' },
  respiratory: { min: 12, max: 20, unit: '次/分', label: '呼吸率' },
  steps: { target: 8000, unit: '步' },
  sleep: { min: 7, max: 9, unit: '小时' },
  bmi: { min: 18.5, max: 24, unit: '', label: 'BMI' },
};

export function getStatus(value, min, max) {
  if (value == null) return 'unknown';
  if (value >= min && value <= max) return 'normal';
  if (value < min) return 'low';
  return 'high';
}

export function getStatusColor(status) {
  return { normal: 'success', low: 'warning', high: 'error', unknown: 'default' }[status] || 'default';
}

export function getStatusLabel(status) {
  return { normal: '正常', low: '偏低', high: '偏高', unknown: '—' }[status] || '—';
}
