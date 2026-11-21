'use strict';
process.env.NODE_ENV = 'test';
delete process.env.GEMINI_API_KEY;
/**
 * @file test/integration/public-and-staff.test.js
 * Integration test covering public endpoints (/config, /stats, /issues filtering, /status-message)
 * and remaining staff console endpoints (analytics, activity, briefing, search, export, bulk, settings).
 */

const test = require('node:test');
const assert = require('node:assert');
const { createApp } = require('../../server');
const { validateMagicBytes, isValidImageType } = require('../../services/storage');
const { sendPushNotification } = require('../../services/notifications');

let server, base;
const mockAdminHeader = { 'x-mock-user': JSON.stringify({ uid: 'admin-coverage', role: 'admin', email: 'admin@cov.test' }) };
const mockOfficerHeader = { 'x-mock-user': JSON.stringify({ uid: 'officer-cov', role: 'officer', email: 'officer@cov.test', department: 'Public Works Department' }) };

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

test('public /api/config returns complete metadata', async () => {
  const res = await req('/api/config');
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.categories));
  assert.ok(Array.isArray(res.body.priorities));
  assert.ok(Array.isArray(res.body.statuses));
  assert.ok(Array.isArray(res.body.supportedLanguages));
  assert.ok(res.body.slaHours);
});

test('public /api/stats returns aggregates', async () => {
  const res = await req('/api/stats');
  assert.equal(res.status, 200);
  assert.ok(res.body.total >= 0);
  assert.ok(res.body.byCategory);
  assert.ok(res.body.byPriority);
});

test('public /api/issues with query filters and pagination', async () => {
  const res = await req('/api/issues?priority=High&pageSize=10');
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.issues));
  assert.ok(typeof res.body.total === 'number');
});

test('public /api/issues/:id/status-message returns translated message', async () => {
  const res = await req('/api/issues/CR-1A2B3C/status-message?lang=ta');
  assert.equal(res.status, 200);
  assert.equal(res.body.id, 'CR-1A2B3C');
  assert.ok(res.body.message);
  assert.equal(res.body.lang, 'ta');

  // Unknown ticket returns 404
  const notFound = await req('/api/issues/CR-UNKNOWN/status-message?lang=ta');
  assert.equal(notFound.status, 404);
});

test('staff /api/staff/me returns officer information', async () => {
  const res = await req('/api/staff/me', { headers: mockOfficerHeader });
  assert.equal(res.status, 200);
  assert.equal(res.body.role, 'officer');
  assert.equal(res.body.department, 'Public Works Department');
});

test('staff /api/staff/stats, /activity, and /officers', async () => {
  const stats = await req('/api/staff/stats', { headers: mockOfficerHeader });
  assert.equal(stats.status, 200);

  const act = await req('/api/staff/activity?limit=5', { headers: mockOfficerHeader });
  assert.equal(act.status, 200);
  assert.ok(Array.isArray(act.body.events));

  const off = await req('/api/staff/officers', { headers: mockOfficerHeader });
  assert.equal(off.status, 200);
  assert.ok(Array.isArray(off.body.officers));
});

test('staff /api/staff/analytics returns trends and distributions', async () => {
  const res = await req('/api/staff/analytics', { headers: mockOfficerHeader });
  assert.equal(res.status, 200);
  assert.ok(typeof res.body.resolutionRate === 'number');
  assert.ok(typeof res.body.slaCompliance === 'number');
  assert.ok(typeof res.body.overrideRate === 'number');
  assert.ok(res.body.byDepartment);
  assert.ok(res.body.byCategory);
  assert.ok(Array.isArray(res.body.trend));
});

test('staff /api/staff/briefing returns daily briefing', async () => {
  const res = await req('/api/staff/briefing', { headers: mockOfficerHeader });
  assert.equal(res.status, 200);
  assert.ok(res.body.text);
});

test('staff /api/staff/search performs search over tickets', async () => {
  const res = await req('/api/staff/search', {
    method: 'POST',
    headers: mockOfficerHeader,
    body: JSON.stringify({ query: 'pothole' })
  });
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.results));
});

test('staff /api/staff/export exports CSV format', async () => {
  const res = await fetch(base + '/api/staff/export', { headers: mockOfficerHeader });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'text/csv; charset=utf-8');
  const csv = await res.text();
  assert.ok(csv.startsWith('ID,Title,Category'));
});

test('staff bulk operations (bulk-assign, bulk-status)', async () => {
  const bulkAssign = await req('/api/staff/reports/bulk-assign', {
    method: 'POST',
    headers: mockOfficerHeader,
    body: JSON.stringify({
      ids: ['CR-1A2B3C', 'CR-4D5E6F'],
      assignedTo: 'officer-test',
      officerName: 'Test Inspector'
    })
  });
  assert.equal(bulkAssign.status, 200);
  assert.ok(bulkAssign.body.count >= 1);

  const bulkStatus = await req('/api/staff/reports/bulk-status', {
    method: 'POST',
    headers: mockOfficerHeader,
    body: JSON.stringify({
      ids: ['CR-1A2B3C'],
      status: 'In Progress',
      note: 'Bulk status update note'
    })
  });
  assert.equal(bulkStatus.status, 200);
  assert.equal(bulkStatus.body.count, 1);
});

test('staff team management (update role, deactivate) and settings', async () => {
  // Update staff member
  const upd = await req('/api/staff/team/officer-cov', {
    method: 'PUT',
    headers: mockAdminHeader,
    body: JSON.stringify({ role: 'officer', department: 'Public Works Department', name: 'Inspector PWD' })
  });
  assert.equal(upd.status, 200);

  // Deactivate
  const deact = await req('/api/staff/team/officer-cov/deactivate', {
    method: 'POST',
    headers: mockAdminHeader
  });
  assert.equal(deact.status, 200);
  assert.equal(deact.body.ok, true);

  // Settings update
  const slaUpd = await req('/api/staff/settings/sla', {
    method: 'PUT',
    headers: mockAdminHeader,
    body: JSON.stringify({ Critical: 12, High: 48, Medium: 120, Low: 240 })
  });
  assert.equal(slaUpd.status, 200);

  const deptUpd = await req('/api/staff/settings/departments', {
    method: 'PUT',
    headers: mockAdminHeader,
    body: JSON.stringify({ departments: [{ category: 'Other', department: 'Municipal Helpline' }] })
  });
  assert.equal(deptUpd.status, 200);

  const mapUpd = await req('/api/staff/settings/mapping', {
    method: 'PUT',
    headers: mockAdminHeader,
    body: JSON.stringify({ mapping: { 'Roads & Potholes': 'PWD' } })
  });
  assert.equal(mapUpd.status, 200);
});

test('storage helpers validate MIME types and magic bytes', () => {
  assert.equal(isValidImageType('image/jpeg'), true);
  assert.equal(isValidImageType('image/png'), true);
  assert.equal(isValidImageType('image/webp'), true);
  assert.equal(isValidImageType('application/pdf'), false);

  // JPEG magic bytes
  assert.equal(validateMagicBytes(Buffer.from([0xFF, 0xD8, 0xFF, 0xE0])), true);
  // PNG magic bytes
  assert.equal(validateMagicBytes(Buffer.from([0x89, 0x50, 0x4E, 0x47])), true);
  // WebP magic bytes
  assert.equal(validateMagicBytes(Buffer.from('RIFF1234WEBP', 'ascii')), true);
  // Invalid
  assert.equal(validateMagicBytes(Buffer.from([0x00, 0x00, 0x00, 0x00])), false);
  assert.equal(validateMagicBytes(null), false);
});

test('notifications stub logs message without throwing', async () => {
  await sendPushNotification('test-uid', 'Hello citizen');
  assert.ok(true);
});
