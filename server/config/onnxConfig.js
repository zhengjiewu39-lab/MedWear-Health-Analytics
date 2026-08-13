'use strict';

/** ONNX is opt-in only — rule engine remains the default product core. */
function isOnnxEnabled() {
  const v = process.env.MEDWEAR_ENABLE_ONNX;
  if (v === undefined || v === null || v === '') return false;
  const s = String(v).trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes';
}

module.exports = { isOnnxEnabled };
