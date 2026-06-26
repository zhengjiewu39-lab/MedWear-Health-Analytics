const MODES = { DEMO: 'demo', REAL: 'real' };

function modeMiddleware(req, res, next) {
  const header = req.headers['x-medwear-mode'];
  req.dataMode = header === MODES.REAL ? MODES.REAL : MODES.DEMO;
  res.setHeader('X-MedWear-Mode', req.dataMode);
  next();
}

function isRealMode(req) {
  return req.dataMode === MODES.REAL;
}

module.exports = { MODES, modeMiddleware, isRealMode };
