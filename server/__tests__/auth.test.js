const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { signToken, verifyToken, authenticate, isPublicPath, getUsers } = require('../security/auth');

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

  it('no longer exposes separate demo account', () => {
    assert.equal(getUsers().demo, undefined);
    assert.equal(authenticate('demo', 'demo123'), null);
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
});
