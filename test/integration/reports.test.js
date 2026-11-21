'use strict';
/**
 * @file test/integration/reports.test.js
 * Integration test for citizen grievance reporting lifecycle:
 * Submit -> Track -> Deduplication -> Support -> Escalation -> Image upload.
 */

const test = require('node:test');
const assert = require('node:assert');
const { createApp } = require('../../server');

let server, base;
const mockCitizenHeader = { 'x-mock-user': JSON.stringify({ uid: 'test-citizen-1', role: 'citizen', email: 'citizen@test.local' }) };

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

test('citizen can submit a report and retrieve it', async () => {
  const res = await req('/api/reports', {
    method: 'POST',
    headers: mockCitizenHeader,
    body: JSON.stringify({
      title: 'Water main burst flooding avenue',
      description: 'Major drinking water pipe broken and water flooding roadway near junction.',
      location: '100 Feet Road, Ward 14',
      category: 'Water & Drainage',
      lat: 11.0200,
      lng: 76.9500,
      language: 'en'
    })
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.duplicate, false);
  assert.ok(res.body.ticketId.startsWith('CR-'));
  assert.equal(res.body.department, 'Water Supply & Drainage Board');
  assert.ok(res.body.expectedResponseHours > 0);

  const ticketId = res.body.ticketId;

  // Track the submitted ticket publicly
  const track = await req(`/api/issues/${ticketId}`);
  assert.equal(track.status, 200);
  assert.equal(track.body.id, ticketId);
  assert.equal(track.body.title, 'Water main burst flooding avenue');
  assert.ok(track.body.timeline.length >= 1);

  // Duplicate detection test: submit nearby within 150m with same category
  const dupRes = await req('/api/reports', {
    method: 'POST',
    headers: mockCitizenHeader,
    body: JSON.stringify({
      title: 'Water flooding road',
      description: 'Large flood on road from broken pipe right here.',
      location: '100 Feet Road, near corner',
      category: 'Water & Drainage',
      lat: 11.0201, // ~11 meters away
      lng: 76.9501,
      language: 'en'
    })
  });

  assert.equal(dupRes.status, 200);
  assert.equal(dupRes.body.duplicate, true);
  assert.match(dupRes.body.message, /already reported nearby/i);
  assert.equal(dupRes.body.issue.id, ticketId);
  assert.equal(dupRes.body.issue.supporters, 2);

  // Citizen my-reports
  const myReports = await req('/api/reports/mine', { headers: mockCitizenHeader });
  assert.equal(myReports.status, 200);
  assert.ok(Array.isArray(myReports.body.reports));
  assert.ok(myReports.body.reports.some(r => r.id === ticketId));

  // Support increment ("I am affected too")
  const sup = await req(`/api/reports/${ticketId}/support`, { method: 'POST' });
  assert.equal(sup.status, 200);
  assert.equal(sup.body.supporters, 3);

  // Escalate ticket
  const esc = await req(`/api/reports/${ticketId}/escalate`, {
    method: 'POST',
    headers: mockCitizenHeader
  });
  assert.equal(esc.status, 200);
  assert.equal(esc.body.ok, true);

  // Request upload URL for photo attachment
  const uploadUrlRes = await req(`/api/reports/${ticketId}/images/upload-url`, {
    method: 'POST',
    headers: mockCitizenHeader,
    body: JSON.stringify({ mimeType: 'image/jpeg', filename: 'evidence.jpg' })
  });
  assert.equal(uploadUrlRes.status, 200);
  assert.ok(uploadUrlRes.body.uploadUrl);
  assert.ok(uploadUrlRes.body.objectPath);

  // Confirm image attachment
  const confirmRes = await req(`/api/reports/${ticketId}/images/confirm`, {
    method: 'POST',
    headers: mockCitizenHeader,
    body: JSON.stringify({ imagePaths: [uploadUrlRes.body.objectPath] })
  });
  assert.equal(confirmRes.status, 200);
  assert.equal(confirmRes.body.ok, true);
  assert.equal(confirmRes.body.imageCount, 1);
});
