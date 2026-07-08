/**
 * Public-health API route tests (service layer + validation).
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const publicHealthRoutes = require('../routes/publicHealth');
const { getPhmService } = require('../public-health/phmService');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/public-health', publicHealthRoutes);
  return app;
}

async function request(app, method, url, body) {
  const http = require('http');
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      const opts = {
        hostname: '127.0.0.1',
        port,
        path: url,
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
      };
      const req = http.request(opts, (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          server.close();
          resolve({ status: res.statusCode, body: JSON.parse(data || '{}') });
        });
      });
      req.on('error', (e) => { server.close(); reject(e); });
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  });
}

describe('GET /api/public-health/summary', () => {
  it('returns 400 without district', async () => {
    const res = await request(buildApp(), 'GET', '/api/public-health/summary?date=2026-01-18');
    assert.equal(res.status, 400);
  });

  it('returns monitoring overview for chaoyang on 2026-01-18', async () => {
    const res = await request(buildApp(), 'GET', '/api/public-health/summary?date=2026-01-18&district=chaoyang');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.monitoring_overview);
    assert.equal(res.body.district_id, '110105');
  });
});

describe('GET /api/public-health/clusters', () => {
  it('returns cluster list for pudong', async () => {
    const res = await request(buildApp(), 'GET', '/api/public-health/clusters?timeWindow=72&district=pudong');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.clusters));
    assert.equal(res.body.time_window_hours, 72);
  });
});

describe('GET /api/public-health/daily-report', () => {
  it('returns daily surveillance report', async () => {
    const res = await request(buildApp(), 'GET', '/api/public-health/daily-report?date=2026-01-18&district=chaoyang');
    assert.equal(res.status, 200);
    assert.equal(res.body.report.report_type, 'daily_surveillance');
  });
});

describe('GET /api/public-health/investigation/:clusterId', () => {
  it('returns 404 for unknown cluster', async () => {
    const res = await request(buildApp(), 'GET', '/api/public-health/investigation/CL-NOPE');
    assert.equal(res.status, 404);
  });

  it('returns investigation report for detected cluster', async () => {
    const svc = getPhmService();
    svc.refreshClusters(72);
    const clusterId = svc.clusters[0]?.clusterId;
    if (!clusterId) return;
    const res = await request(buildApp(), 'GET', `/api/public-health/investigation/${clusterId}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.report.report_type, 'cluster_investigation');
  });
});

describe('POST /api/public-health/register-user', () => {
  it('validates required fields', async () => {
    const res = await request(buildApp(), 'POST', '/api/public-health/register-user', { age: 30 });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'MISSING_USER_ID');
  });

  it('registers a new monitored user', async () => {
    const res = await request(buildApp(), 'POST', '/api/public-health/register-user', {
      userId: 'TEST-API-USER',
      age: 40,
      ses: 'low',
      coordinates: { lat: 31.23, lng: 121.47 },
      district_id: '310115',
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.user_id, 'TEST-API-USER');
  });
});

describe('GET /api/public-health/equity-analysis', () => {
  it('returns equity report', async () => {
    const res = await request(buildApp(), 'GET', '/api/public-health/equity-analysis?date=2026-01-18&district=chaoyang');
    assert.equal(res.status, 200);
    assert.equal(res.body.report.report_type, 'equity_analysis');
  });
});
