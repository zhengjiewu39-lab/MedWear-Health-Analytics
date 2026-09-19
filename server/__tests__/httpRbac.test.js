const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.ALLOW_DEMO_AUTH = 'true';
process.env.MEDWEAR_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'medwear-http-test-'));

const { signToken } = require('../security/auth');

let app;

function request(method, path, token, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      const payload = body != null ? JSON.stringify(body) : null;
      const req = http.request({
        host: '127.0.0.1',
        port,
        path,
        method,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...extraHeaders,
        },
      }, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          server.close();
          let json = {};
          try { json = JSON.parse(body || '{}'); } catch { /* empty */ }
          resolve({ status: res.statusCode, json });
        });
      });
      req.on('error', (err) => { server.close(); reject(err); });
      if (payload) req.write(payload);
      req.end();
    });
    server.on('error', reject);
  });
}

describe('HTTP RBAC smoke', () => {
  before(() => {
    ({ app } = require('../../server'));
  });

  it('viewer cannot POST research evaluate', async () => {
    const token = signToken({ id: 2, username: 'demo', role: 'viewer' });
    const res = await request('POST', '/api/research/wearable/evaluate', token);
    assert.equal(res.status, 403);
  });

  it('viewer cannot GET admin overview', async () => {
    const token = signToken({ id: 2, username: 'demo', role: 'viewer' });
    const res = await request('GET', '/api/admin/overview', token);
    assert.equal(res.status, 403);
  });

  it('admin can GET admin overview', async () => {
    const token = signToken({ id: 1, username: 'admin', role: 'admin' });
    const res = await request('GET', '/api/admin/overview', token);
    assert.equal(res.status, 200);
    assert.equal(typeof res.json.patientCount, 'number');
  });

  it('admin can POST settings thresholds', async () => {
    const token = signToken({ id: 1, username: 'admin', role: 'admin' });
    const res = await request('POST', '/api/settings/thresholds', token, { spo2Min: 93 });
    assert.equal(res.status, 200);
    assert.equal(res.json.success, true);
    assert.equal(res.json.alertThresholds.spo2Min, 93);
  });

  it('real mode disables individual outcome comparison', async () => {
    const token = signToken({ id: 1, username: 'admin', role: 'admin' });
    const res = await request(
      'GET',
      '/api/outcomes/patient-comparison',
      token,
      null,
      { 'x-medwear-mode': 'real' },
    );
    assert.equal(res.status, 404);
    assert.equal(res.json.exploratoryDisabled, true);
    assert.equal(res.json.syntheticProjection, true);
  });
});
