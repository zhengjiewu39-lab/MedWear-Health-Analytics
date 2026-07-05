const PATIENTS = [
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
  {
    id: 4, name: '陈静', gender: '女', age: 29, phone: '137****7712',
    riskLevel: 'low', healthScore: 91, conditions: [], devices: 1,
    lastActive: '今天 07:55',
  },
  {
    id: 5, name: '刘洋', gender: '男', age: 45, phone: '135****4418',
    riskLevel: 'medium', healthScore: 76, conditions: ['睡眠呼吸暂停'], devices: 2,
    lastActive: '今天 06:20',
  },
  {
    id: 6, name: '赵敏', gender: '女', age: 61, phone: '133****9901',
    riskLevel: 'high', healthScore: 54, conditions: ['房颤', '高血压'], devices: 2,
    lastActive: '昨天 18:40',
  },
];

const DEPARTMENTS = [
  { id: 1, name: '心内科', description: '心血管监测与慢病管理', staffCount: 12, patientCount: 86 },
  { id: 2, name: '内分泌科', description: '代谢与血糖管理', staffCount: 8, patientCount: 54 },
  { id: 3, name: '康复医学科', description: '术后与运动康复', staffCount: 6, patientCount: 32 },
  { id: 4, name: '健康管理中心', description: '体检与可穿戴筛查', staffCount: 10, patientCount: 120 },
];

const STAFF = [
  { id: 1, name: '李主任', department: '心内科', title: '主任医师', role: '主任', patients: 28, status: '在岗' },
  { id: 2, name: '王医生', department: '心内科', title: '主治医师', role: '医生', patients: 22, status: '在岗' },
  { id: 3, name: '陈护士', department: '健康管理中心', title: '主管护师', role: '护士', patients: 45, status: '在岗' },
  { id: 4, name: '赵医生', department: '内分泌科', title: '副主任医师', role: '医生', patients: 18, status: '在岗' },
  { id: 5, name: '孙管理员', department: '信息科', title: '系统管理员', role: '管理员', patients: 0, status: '在岗' },
];

function registerAdminRoutes(app) {
  app.get('/api/admin/patients', (_req, res) => {
    res.json(PATIENTS);
  });

  app.get('/api/admin/departments', (_req, res) => {
    res.json(DEPARTMENTS);
  });

  app.get('/api/admin/staff', (_req, res) => {
    res.json(STAFF);
  });

  app.get('/api/admin/overview', (_req, res) => {
    const highRisk = PATIENTS.filter((p) => p.riskLevel === 'high').length;
    res.json({
      patientCount: PATIENTS.length,
      highRiskCount: highRisk,
      staffCount: STAFF.length,
      departmentCount: DEPARTMENTS.length,
      activeDevices: PATIENTS.reduce((sum, p) => sum + p.devices, 0),
      pendingAlerts: 3,
    });
  });

  console.log('[MedWear] Admin routes: /api/admin/overview, /patients, /departments, /staff');
}

module.exports = { registerAdminRoutes, PATIENTS, DEPARTMENTS, STAFF };
