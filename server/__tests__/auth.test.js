const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  signToken, verifyToken, authenticate, isPublicPath, getUsers, requireRole,
} = require('../security/auth');

describe('MedWear auth', () => {
  it('authenticates admin user', () => {
    const result = authenticate('admin', 'admin123');
    assert.ok(result);
    assert.equal(result.user.username, 'admin');
    assert.equal(result.user.role, 'admin');
  });

  it('rejects invalid password', () => {
    assert.equal(authenticate('admin', 'wrong'), null);
  });

  it('authenticates demo account when ALLOW_DEMO is enabled', () => {
    assert.ok(getUsers().demo);
    const result = authenticate('demo', 'demo123');
    assert.ok(result);
    assert.equal(result.user.username, 'demo');
    assert.equal(result.user.role, 'viewer');
  });

  it('signs and verifies JWT', () => {
    const user = { id: 1, username: 'admin', role: 'admin' };
    const token = signToken(user);
    assert.equal(verifyToken(`Bearer ${token}`).username, 'admin');
  });

  it('public paths include health and login', () => {
    assert.equal(isPublicPath('/api/health'), true);
    assert.equal(isPublicPath('/api/dashboard/stats'), false);
  });

  it('requireRole allows admin and blocks viewer', () => {
    let statusCode;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json() {},
    };
    const next = () => { nextCalled = true; };
    let nextCalled = false;

    requireRole('admin')({ user: { role: 'admin' } }, res, next);
    assert.equal(nextCalled, true);

    nextCalled = false;
    requireRole('admin')({ user: { role: 'viewer' } }, res, () => { nextCalled = true; });
    assert.equal(nextCalled, false);
    assert.equal(statusCode, 403);
  });
});
