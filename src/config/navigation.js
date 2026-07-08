export const NAV_SECTIONS = [
  {
    id: 'overview',
    label: '概览',
    items: [
      { text: '管理控制台', path: '/admin', adminOnly: true },
      { text: '健康总览', path: '/dashboard' },
    ],
  },
  {
    id: 'phm',
    label: '公共卫生监测',
    items: [
      { text: '监测仪表盘', path: '/public-health' },
    ],
  },
  {
    id: 'clinical',
    label: '临床运营',
    items: [
      { text: '患者管理', path: '/admin/patients', adminOnly: true },
      { text: '实时监测', path: '/monitoring' },
      { text: 'ECG 心电', path: '/ecg' },
      { text: '预警中心', path: '/alerts' },
      { text: '临床筛查', path: '/screening' },
      { text: '预约体检', path: '/appointments' },
      { text: '医生报告', path: '/doctor-report' },
    ],
  },
  {
    id: 'admin',
    label: '系统管理',
    adminOnly: true,
    items: [
      { text: '组织架构', path: '/admin/organization' },
      { text: '合规管理', path: '/admin/compliance' },
      { text: '报告中心', path: '/admin/reports' },
      { text: '互联平台', path: '/platform' },
      { text: '分析评价', path: '/research' },
      { text: '系统设置', path: '/settings' },
    ],
  },
  {
    id: 'ai',
    label: 'AI 智能分析',
    collapsible: true,
    defaultOpen: false,
    items: [
      { text: 'AI 健康助手', path: '/ai/assistant' },
      { text: 'AI 健康报告', path: '/ai/report' },
      { text: '异常检测', path: '/ai/anomaly' },
      { text: '预测分析', path: '/ai/predictive' },
      { text: '睡眠分析', path: '/ai/sleep' },
      { text: '恢复与压力', path: '/ai/recovery' },
      { text: '数字孪生', path: '/ai/digital-twin' },
      { text: '数据融合', path: '/ai/fusion' },
      { text: '健康目标', path: '/ai/goals' },
    ],
  },
  {
    id: 'devices',
    label: '设备',
    items: [
      { text: '我的设备', path: '/devices' },
    ],
  },
];

export function flattenNavItems(sections, isAdmin) {
  return sections.flatMap((section) => {
    if (section.adminOnly && !isAdmin) return [];
    return section.items.filter((item) => !item.adminOnly || isAdmin);
  });
}

export function getPageTitle(pathname, isAdmin) {
  const items = flattenNavItems(NAV_SECTIONS, isAdmin);
  const match = items.find((item) => item.path === pathname);
  if (match) return match.text;
  if (pathname === '/import') return '数据导入';
  if (pathname === '/public-health') return '公共卫生监测';
  return 'MedWear';
}

export const ADMIN_QUICK_ACTIONS = [
  { title: '患者管理', desc: '档案与风险分级', path: '/admin/patients', color: '#4f46e5' },
  { title: '预警中心', desc: '待处理异常事件', path: '/alerts', color: '#dc2626' },
  { title: '数据导入', desc: 'Apple Health 接入', path: '/import', color: '#0d9488' },
  { title: '公共卫生', desc: '聚集点与流行病学监测', path: '/public-health', color: '#b45309' },
  { title: '报告中心', desc: '生成与导出报告', path: '/admin/reports', color: '#0284c7' },
  { title: '组织架构', desc: '科室与人员', path: '/admin/organization', color: '#7c3aed' },
  { title: '系统设置', desc: '安全与 AI 配置', path: '/settings', color: '#64748b' },
];
