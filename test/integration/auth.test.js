'use strict';
/**
 * @file test/integration/auth.test.js
 * Integration test for auth endpoints:
 * Session exchange, user info /me, and logout.
 */

const test = require('node:test');
const assert = require('node:assert');
const { createApp } = require('../../server');

let server, base;
const mockCitizenHeader = { 'x-mock-user': JSON.stringify({ uid: 'auth-test-uid', role: 'citizen', email: 'citizen@auth.test' }) };

test.before(() => new Promise(resolve => {
  server = createApp().listen(0, () => {
    base = `http://127.0.0.1:${server.address().port}`;
    resolve();
  });
}));

test.after(() => server.close());

const req = (path, opts = {}) => fetch(base + path, {
  ...opts,
  headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) }
}).then(async r => ({ status: r.status, body: await r.json() }));

test('auth session exchange handles validation and error cleanly', async () => {
  // Invalid token payload (< 100 chars)
  const badToken = await req('/api/auth/session', {
    method: 'POST',
    body: JSON.stringify({ idToken: 'short' })
  });
  assert.equal(badToken.status, 400);

  // Fake token that fails verification
  const fakeToken = await req('/api/auth/session', {
    method: 'POST',
    body: JSON.stringify({ idToken: 'a'.repeat(120) })
  });
  assert.equal(fakeToken.status, 401);
});

test('auth /me returns current user profile when authenticated', async () => {
  const res = await req('/api/auth/me', { headers: mockCitizenHeader });
  assert.equal(res.status, 200);
  assert.equal(res.body.uid, 'auth-test-uid');
  assert.equal(res.body.role, 'citizen');
});

test('auth logout clears session', async () => {
  const res = await req('/api/auth/logout', { method: 'POST' });
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
});
