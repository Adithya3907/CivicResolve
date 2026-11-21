'use strict';
process.env.NODE_ENV = 'test';
delete process.env.GEMINI_API_KEY;
/**
 * @file test/integration/staff.test.js
 * Integration test for staff console workflow:
 * RBAC separation, report listing, status transition, AI override with audit log, bulk operations.
 */

const test = require('node:test');
const assert = require('node:assert');
const { createApp } = require('../../server');

let server, base;
const mockOfficerHeader = { 'x-mock-user': JSON.stringify({ uid: 'officer-1', role: 'officer', email: 'officer@pwd.gov.in', department: 'Public Works Department' }) };
const mockAdminHeader   = { 'x-mock-user': JSON.stringify({ uid: 'admin-1', role: 'admin', email: 'admin@municipality.gov.in' }) };
const mockCitizenHeader = { 'x-mock-user': JSON.stringify({ uid: 'citizen-1', role: 'citizen', email: 'citizen@test.local' }) };

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

test('citizen tokens cannot access staff endpoints', async () => {
  const res = await req('/api/staff/reports', { headers: mockCitizenHeader });
  assert.equal(res.status, 403);
});

test('unauthenticated requests cannot access staff endpoints', async () => {
  const res = await req('/api/staff/reports');
  assert.equal(res.status, 401);
});

test('officer can view reports, update status, and perform override with audit logging', async () => {
  // 1. Officer view reports
  const list = await req('/api/staff/reports', { headers: mockOfficerHeader });
  assert.equal(list.status, 200);
  assert.ok(Array.isArray(list.body.reports));
  assert.ok(list.body.total > 0);

  const ticket = list.body.reports[0];
  const ticketId = ticket.id;

  // 2. Officer view report details
  const detail = await req(`/api/staff/reports/${ticketId}`, { headers: mockOfficerHeader });
  assert.equal(detail.status, 200);
  assert.equal(detail.body.id, ticketId);

  // 3. Officer update status to In Progress
  const statusUpdate = await req(`/api/staff/reports/${ticketId}/status`, {
    method: 'POST',
    headers: mockOfficerHeader,
    body: JSON.stringify({
      status: 'In Progress',
      internalNote: 'Dispatched emergency crew to attend site.',
      publicNote: 'Maintenance unit in transit.'
    })
  });
  assert.equal(statusUpdate.status, 200);
  assert.equal(statusUpdate.body.status, 'In Progress');

  // 4. Officer AI override with mandatory reason
  const overrideRes = await req(`/api/staff/reports/${ticketId}/override`, {
    method: 'POST',
    headers: mockOfficerHeader,
    body: JSON.stringify({
      priority: 'Critical',
      reason: 'Observed severe vehicular hazard during on-site ground inspection'
    })
  });
  assert.equal(overrideRes.status, 200);
  assert.equal(overrideRes.body.priority, 'Critical');
  assert.ok(overrideRes.body.adminOverride);

  // 5. Audit log reflects the actions
  const audit = await req(`/api/staff/reports/${ticketId}/audit`, { headers: mockOfficerHeader });
  assert.equal(audit.status, 200);
  assert.ok(audit.body.audit.length >= 2);
  assert.ok(audit.body.audit.some(a => a.action === 'AI_OVERRIDE'));

  // 6. Verification endpoint
  const verifyRes = await req(`/api/staff/reports/${ticketId}/verify`, {
    method: 'POST',
    headers: mockOfficerHeader,
    body: JSON.stringify({ afterImagePaths: [] })
  });
  assert.equal(verifyRes.status, 200);
  assert.ok(verifyRes.body.reason);
});

test('admin can manage staff team and settings', async () => {
  // Team list
  const team = await req('/api/staff/team', { headers: mockAdminHeader });
  assert.equal(team.status, 200);
  assert.ok(Array.isArray(team.body.users));

  // Officer cannot access admin-only team endpoint
  const officerForbidden = await req('/api/staff/team', { headers: mockOfficerHeader });
  assert.equal(officerForbidden.status, 403);

  // Invite staff member
  const invite = await req('/api/staff/team/invite', {
    method: 'POST',
    headers: mockAdminHeader,
    body: JSON.stringify({
      email: 'new-officer@municipality.gov.in',
      role: 'officer',
      department: 'Solid Waste Management',
      name: 'Field Officer Kumar'
    })
  });
  assert.equal(invite.status, 201);
  assert.equal(invite.body.email, 'new-officer@municipality.gov.in');

  // Settings
  const settings = await req('/api/staff/settings', { headers: mockAdminHeader });
  assert.equal(settings.status, 200);
  assert.ok(settings.body.sla);
  assert.ok(settings.body.categories);
});
