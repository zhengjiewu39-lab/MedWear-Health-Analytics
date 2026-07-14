import { PATHWAY_STEPS, OUTCOMES_STEP, THESIS_NAV_ITEMS } from './interventionPathway';

export const NAV_SECTIONS = [
  {
    id: 'pathway',
    label: '干预路径',
    items: PATHWAY_STEPS.map((s) => ({ text: s.text, path: s.path })),
  },
  {
    id: 'thesis',
    label: '论文核心',
    defaultOpen: true,
    items: THESIS_NAV_ITEMS.map((s) => ({ text: s.text, path: s.path })),
  },
  {
    id: 'data',
    label: '数据管理',
    adminOnly: true,
    items: [
      { text: 'AI 临床助手', path: '/ai/chat' },
      { text: '患者队列', path: '/admin/patients' },
      { text: '系统设置', path: '/settings' },
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
  if (pathname === '/outcomes') return '结局对比';
  if (pathname === '/research') return '研究评价';
  if (pathname === '/methodology') return '方法学文档';
  if (pathname === '/import') return '数据导入';
  return 'MedWear';
}

export const ADMIN_QUICK_ACTIONS = [
  { title: 'AI 临床助手', title_en: 'Clinical AI', desc: '真实LLM·随时提问', desc_en: 'Live LLM · ask anytime', path: '/ai/chat', color: '#7c3aed' },
  { title: '结局对比', title_en: 'Outcome Comparison', desc: '早诊率·治疗率·存活率', desc_en: 'Early dx · treatment · survival', path: '/outcomes', color: '#1565C0' },
  { title: '临床筛查', title_en: 'Clinical Screening', desc: '肿瘤/慢病早筛预测', desc_en: 'Tumor/chronic early screening', path: '/screening', color: '#b45309' },
  { title: '患者队列', title_en: 'Patient Cohort', desc: '5000 例统一合成队列', desc_en: '5,000 unified synthetic cohort', path: '/admin/patients', color: '#4f46e5' },
  { title: '研究评价', title_en: 'Research & Evaluation', desc: '基准评测与复现', desc_en: 'Benchmark evaluation & reproduction', path: '/research', color: '#0d9488' },
  { title: '系统设置', title_en: 'Settings', desc: '语言与安全配置', desc_en: 'Language & security', path: '/settings', color: '#64748b' },
];

export { OUTCOMES_STEP, PATHWAY_STEPS, THESIS_NAV_ITEMS };
