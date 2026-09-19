/** Demo organization structure for admin UI (not clinical data). */

const DEMO_DEPARTMENTS = [
  { id: 'dept-cardio', name: '心血管监测组', description: '可穿戴信号与 BHI 研究分析协作', staffCount: 12, patientCount: 420 },
  { id: 'dept-digital', name: '数字表型实验室', description: 'Apple Health 导入与本地分析流水线', staffCount: 8, patientCount: 180 },
  { id: 'dept-research', name: '研究评价组', description: '合成基准复现与 methods 文档', staffCount: 6, patientCount: 0 },
  { id: 'dept-it', name: '平台运维', description: '单机部署、审计与数据安全', staffCount: 4, patientCount: 0 },
];

const DEMO_STAFF = [
  { id: 1, name: '张研', department: '数字表型实验室', title: '研究员', role: '主任', patients: 45, status: '在岗' },
  { id: 2, name: '李数', department: '研究评价组', title: '数据工程师', role: '工程师', patients: 0, status: '在岗' },
  { id: 3, name: '王护', department: '心血管监测组', title: '研究护士', role: '协调员', patients: 120, status: '在岗' },
  { id: 4, name: '陈管', department: '平台运维', title: '系统管理员', role: '管理员', patients: 0, status: '在岗' },
];

module.exports = { DEMO_DEPARTMENTS, DEMO_STAFF };
