'use strict';
const test = require('node:test'), assert = require('node:assert');
const os = require('os'), path = require('path');
process.env.DATA_FILE = path.join(os.tmpdir(), `cr-${process.pid}.json`);
process.env.ADMIN_PASSWORD = 'secret'; delete process.env.GEMINI_API_KEY;
const { createApp } = require('../server');
const { validate, fallbackAnalyze, distM } = require('../lib/core');
let server, base;
test.before(() => new Promise(r => { server = createApp().listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; r(); }); }));
test.after(() => server.close());
const j = (p, o = {}) => fetch(base + p, { ...o, headers: { 'Content-Type': 'application/json', ...(o.headers || {}) } }).then(async r => ({ status: r.status, body: await r.json() }));

test('validate rejects short input and bad images', () => {
  assert.ok(validate({ title: 'x', description: 'long enough text', location: 'abc' }).error);
  assert.ok(validate({ title: 'Pothole', description: 'big pothole here', location: 'Main', image: 'javascript:alert(1)' }).error);
  assert.ok(validate({ title: 'Pothole', description: 'big pothole here', location: 'Main' }).value);
});
test('fallback triage detects urgency and category', () => {
  const r = fallbackAnalyze({ title: 'Open manhole', description: 'open manhole near school gate', category: '' });
  assert.equal(r.priority, 'Critical'); assert.equal(r.category, 'Water & Drainage');
});
test('distance helper is sane', () => assert.ok(distM(11, 77, 11.001, 77) < 120));
test('submit, track, dedupe, admin resolve', async () => {
  const body = JSON.stringify({ title: 'Big pothole', description: 'Huge pothole on the main road causing accidents', location: 'Test Road', lat: 12.3456, lng: 78.9012, name: 'Secret Name' });
  const c = await j('/api/issues', { method: 'POST', body });
  assert.equal(c.status, 201); assert.equal(c.body.issue.category, 'Roads & Potholes'); assert.equal(c.body.issue.name, undefined);
  const id = c.body.issue.id;
  assert.equal((await j('/api/issues/' + id)).body.status, 'Reported');
  assert.equal((await j('/api/issues', { method: 'POST', body })).body.duplicate, true);
  assert.equal((await j('/api/issues/' + id)).body.supporters, 2);
  assert.equal((await j('/api/admin/issues/' + id, { method: 'PATCH', body: JSON.stringify({ status: 'Resolved' }) })).status, 401);
  const t = (await j('/api/admin/login', { method: 'POST', body: JSON.stringify({ password: 'secret' }) })).body.token;
  const u = await j('/api/admin/issues/' + id, { method: 'PATCH', headers: { Authorization: 'Bearer ' + t }, body: JSON.stringify({ status: 'Resolved', note: 'Fixed' }) });
  assert.equal(u.body.status, 'Resolved'); assert.equal(u.body.timeline.length, 2);
  assert.ok((await j('/api/stats')).body.resolved >= 2);
});
test('wrong admin password and unknown ticket', async () => {
  assert.equal((await j('/api/admin/login', { method: 'POST', body: JSON.stringify({ password: 'nope' }) })).status, 401);
  assert.equal((await j('/api/issues/CR-NOPE')).status, 404);
});

test('explain works without a key and briefing requires admin', async () => {
  const r = await j('/api/issues/CR-1A2B3C/explain?lang=Tamil');
  assert.equal(r.status, 200); assert.match(r.body.text, /CR-1A2B3C/);
  assert.equal((await j('/api/admin/briefing')).status, 401);
  const t = (await j('/api/admin/login', { method: 'POST', body: JSON.stringify({ password: 'secret' }) })).body.token;
  const b = await j('/api/admin/briefing', { headers: { Authorization: 'Bearer ' + t } });
  assert.equal(b.status, 200); assert.ok(b.body.text.length > 5);
});
