const { filterPatients, getAdminOverview } = require('../screening/patientRegistry');
const { isRealMode } = require('../middleware/mode');

function registerAdminRoutes(app) {
  app.get('/api/admin/patients', (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 120, 500);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const filters = {
      arm: req.query.arm,
      riskTier: req.query.riskTier,
      category: req.query.category,
      q: req.query.q,
      limit,
      offset,
    };
    const result = filterPatients(undefined, filters);
    const payload = { ...result, cohortMeta: { n: 5000, source: 'screening-outcome' } };
    if (!isRealMode(req)) payload.activeId = req.demoPatientId;
    res.json(payload);
  });

  app.get('/api/admin/overview', (req, res) => {
    const overview = getAdminOverview();
    if (!isRealMode(req)) overview.activeId = req.demoPatientId;
    res.json(overview);
  });

  console.log('[MedWear] Admin routes: /api/admin/overview, /patients (n=5000 cohort)');
}

module.exports = { registerAdminRoutes };
