/** Unified Recharts palette — high-contrast intervention (blue) vs control (orange). */

export const CHART = {
  intervention: '#1d4ed8',
  interventionMid: '#3b82f6',
  interventionLight: '#93c5fd',
  control: '#ea580c',
  controlMid: '#f97316',
  controlLight: '#fdba74',
  grid: '#e2e8f0',
  axis: '#475569',
  axisMuted: '#64748b',
  paper: '#ffffff',
  tooltipBg: '#0f172a',
  tooltipBorder: '#334155',
  tooltipText: '#f8fafc',
  positive: '#16a34a',
  warning: '#d97706',
  danger: '#dc2626',
  info: '#0284c7',
  accent: '#0891b2',
  stage: {
    I: '#16a34a',
    II: '#22c55e',
    III: '#f59e0b',
    IV: '#ef4444',
  },
  risk: {
    low: '#16a34a',
    moderate: '#f59e0b',
    high: '#ef4444',
    unknown: '#94a3b8',
  },
  series: [
    '#1d4ed8',
    '#0891b2',
    '#7c3aed',
    '#ea580c',
    '#db2777',
    '#16a34a',
    '#2563eb',
    '#f97316',
  ],
  funnel: [
    '#1d4ed8',
    '#2563eb',
    '#3b82f6',
    '#0891b2',
    '#06b6d4',
    '#ea580c',
    '#f97316',
  ],
  category: {
    tumor: '#1d4ed8',
    cancer: '#7c3aed',
    chronic: '#ea580c',
    cardio: '#ef4444',
    common: '#0891b2',
    respiratory: '#0284c7',
  },
};

export const AXIS = {
  tick: { fill: CHART.axis, fontSize: 12, fontWeight: 600 },
  tickSmall: { fill: CHART.axisMuted, fontSize: 11, fontWeight: 600 },
};

export const GRID = {
  strokeDasharray: '4 4',
  stroke: CHART.grid,
  vertical: false,
};

export function pctTick(v) {
  return `${v}%`;
}

export function chartMargin(compact = false) {
  return compact
    ? { top: 8, right: 12, left: 0, bottom: 4 }
    : { top: 12, right: 16, left: 4, bottom: 8 };
}
