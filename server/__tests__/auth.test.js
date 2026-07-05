const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { signToken, verifyToken, authenticate, isPublicPath } = require('../security/auth');

describe('MedWear auth', () => {
  it('authenticates demo user', () => {
    const result = authenticate('demo', 'demo123');
    assert.ok(result);
    assert.equal(result.user.username, 'demo');
  });

  it('rejects invalid password', () => {
    assert.equal(authenticate('demo', 'wrong'), null);
  });

  it('signs and verifies JWT', () => {
    const user = { id: 2, username: 'demo', role: 'user' };
    const token = signToken(user);
    assert.equal(verifyToken(`Bearer ${token}`).username, 'demo');
  });

  it('public paths include health and login', () => {
    assert.equal(isPublicPath('/api/health'), true);
    assert.equal(isPublicPath('/api/dashboard/stats'), false);
  });
});
