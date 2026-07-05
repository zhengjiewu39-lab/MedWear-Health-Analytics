/** 管理端演示数据（API 不可用时的前端兜底） */
export const ADMIN_OVERVIEW_FALLBACK = {
  patientCount: 6,
  highRiskCount: 2,
  staffCount: 5,
  departmentCount: 4,
  activeDevices: 11,
  pendingAlerts: 3,
};

export const ADMIN_PATIENTS_FALLBACK = [
  {
    id: 1, name: '张明', gender: '男', age: 52, phone: '138****5621',
    riskLevel: 'medium', healthScore: 72, conditions: ['高血压'], devices: 2,
    lastActive: '今天 09:42',
  },
  {
    id: 2, name: '李芳', gender: '女', age: 38, phone: '139****8834',
    riskLevel: 'low', healthScore: 88, conditions: [], devices: 1,
    lastActive: '今天 08:15',
  },
  {
    id: 3, name: '王建国', gender: '男', age: 67, phone: '136****2209',
    riskLevel: 'high', healthScore: 58, conditions: ['2型糖尿病', '冠心病'], devices: 3,
    lastActive: '昨天 21:30',
  },
];

export const ADMIN_DEPARTMENTS_FALLBACK = [
  { id: 1, name: '心内科', description: '心血管监测与慢病管理', staffCount: 12, patientCount: 86 },
  { id: 2, name: '健康管理中心', description: '体检与可穿戴筛查', staffCount: 10, patientCount: 120 },
];

export const ADMIN_STAFF_FALLBACK = [
  { id: 1, name: '李主任', department: '心内科', title: '主任医师', role: '主任', patients: 28, status: '在岗' },
  { id: 2, name: '孙管理员', department: '信息科', title: '系统管理员', role: '管理员', patients: 0, status: '在岗' },
];
