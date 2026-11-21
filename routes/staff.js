'use strict';
/**
 * @file routes/staff.js
 * Staff console endpoints for officers and administrators.
 * Strict separation: citizens cannot access these endpoints.
 */

const express = require('express');
const { CATEGORIES, PRIORITIES, STATUSES, DEPARTMENTS, SLA_HOURS, computeDueAt, clean } = require('../config/constants');
const store = require('../services/store');
const { verifyResolution, generateDailyBriefing, naturalLanguageSearch } = require('../services/ai');
const { generateStatusMessage } = require('../services/notifications');
const { getSignedReadUrl } = require('../services/storage');
const { verifyToken, requireStaff, requireAdmin } = require('../middleware/auth');
const { validateBody, validateQuery, updateReportSchema, aiOverrideSchema, listReportsQuerySchema, nlSearchSchema } = require('../middleware/validation');
const { strictLimiter } = require('../middleware/security');
const { wrap, httpError } = require('../middleware/errorHandler');

const router = express.Router();

// All staff endpoints require authentication and staff role (officer or admin)
router.use(verifyToken, requireStaff, (req, res, next) => {
  const blockedDemoPaths = ['/activity', '/officers', '/briefing', '/export'];

  if (req.user.demo === true &&
      (req.method !== 'GET' || blockedDemoPaths.includes(req.path))) {
    return next(httpError(403, 'This feature is unavailable to demo staff.', 'DEMO_RESTRICTED'));
  }

  next();
});

// ── GET /api/staff/me ─────────────────────────────────────────────────────────
router.get('/me', wrap(async (req, res) => {
  const profile = await store.getUser(req.user.uid);
  res.json({
    uid: req.user.uid,
    email: req.user.email,
    role: req.user.role,
    department: req.user.department || (profile && profile.department) || '',
    name: (profile && profile.name) || req.user.email || 'Staff Officer'
  });
}));

// ── GET /api/staff/stats ──────────────────────────────────────────────────────
router.get('/stats', wrap(async (_req, res) => {
  const stats = await store.getStats();
  res.json(stats);
}));

// ── GET /api/staff/activity ───────────────────────────────────────────────────
router.get('/activity', wrap(async (req, res) => {
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || '15', 10)));
  const { docs: logs } = await store.listReports({}, { field: 'updatedAt', dir: 'desc' }, { limit, offset: 0 });
  const events = logs.map(r => ({
    id: r.id,
    ticketId: r.id,
    title: r.title,
    status: r.status,
    priority: r.priority,
    department: r.department,
    updatedAt: r.updatedAt || r.createdAt,
    lastNote: (r.timeline && r.timeline.length) ? r.timeline[r.timeline.length - 1].note : ''
  }));
  res.json({ events });
}));

// ── GET /api/staff/officers ───────────────────────────────────────────────────
router.get('/officers', wrap(async (_req, res) => {
  const users = await store.listUsers();
  const officers = users
    .filter(u => u.role === 'officer' || u.role === 'admin')
    .map(u => ({
      uid: u.uid,
      name: u.name || u.email || 'Officer',
      email: u.email || '',
      department: u.department || '',
      role: u.role
    }));
  res.json({ officers });
}));

// ── GET /api/staff/reports ────────────────────────────────────────────────────
router.get('/reports', validateQuery(listReportsQuerySchema), wrap(async (req, res) => {
  const q = req.query;
  const filters = {};

  if (q.status) filters.status = q.status;
  if (q.priority) filters.priority = q.priority;
  if (q.category) filters.category = q.category;
  if (q.ward) filters.ward = q.ward;
  if (q.overdue) filters.overdue = q.overdue;

  // Officers scoped to their department unless admin or explicitly specified
  if (req.user.demo === true) {
    filters.department = req.user.department;
  } else if (req.user.role === 'officer' && req.user.department && !q.department) {
    filters.department = req.user.department;
  } else if (q.department) {
    filters.department = q.department;
  }

  const sort = { field: q.sortBy || 'createdAt', dir: q.sortDir || 'desc' };
  const pageSize = q.pageSize || 20;
  const offset = q.offset ? parseInt(q.offset, 10) : 0;

  const { docs, total } = await store.listReports(filters, sort, { limit: pageSize, offset });

  // Map signed URLs for images asynchronously
  const reportsWithImages = await Promise.all(docs.map(async (doc) => {
    let images = [];
    if (Array.isArray(doc.imagePaths)) {
      images = await Promise.all(doc.imagePaths.map(p => getSignedReadUrl(p)));
    }
    return { ...doc, images };
  }));

  res.json({
    reports: reportsWithImages,
    total,
    pageSize,
    page: Math.floor(offset / pageSize) + 1
  });
}));

// ── GET /api/staff/reports/:id ────────────────────────────────────────────────
router.get('/reports/:id', wrap(async (req, res) => {
  const id = req.params.id.toUpperCase();
  const report = await store.getReport(id);
  if (!report) throw httpError(404, 'Report not found.', 'NOT_FOUND');
  if (req.user.demo === true && report.department !== req.user.department) throw httpError(404, 'Report not found.', 'NOT_FOUND');

  // Generate signed URLs for report images
  let images = [];
  if (Array.isArray(report.imagePaths)) {
    images = await Promise.all(report.imagePaths.map(p => getSignedReadUrl(p)));
  }

  let afterImages = [];
  if (Array.isArray(report.afterImagePaths)) {
    afterImages = await Promise.all(report.afterImagePaths.map(p => getSignedReadUrl(p)));
  }

  res.json({
    ...report,
    images,
    afterImages
  });
}));

// ── POST /api/staff/reports/:id/status ────────────────────────────────────────
router.post('/reports/:id/status', strictLimiter, validateBody(updateReportSchema), wrap(async (req, res) => {
  const id = req.params.id.toUpperCase();
  const report = await store.getReport(id);
  if (!report) throw httpError(404, 'Report not found.', 'NOT_FOUND');

  const { status, internalNote, publicNote } = req.body;
  const prevStatus = report.status;
  const now = new Date().toISOString();

  const patch = {};
  if (status && STATUSES.includes(status)) {
    patch.status = status;
  }

  const noteText = publicNote || internalNote || `Status updated to ${status || report.status}`;
  const timelineEntry = {
    status: status || report.status,
    at: now,
    note: noteText,
    by: req.user.email || req.user.uid
  };

  patch.timeline = [...(report.timeline || []), timelineEntry];
  if (internalNote) {
    patch.internalNotes = [...(report.internalNotes || []), { at: now, note: internalNote, by: req.user.email }];
  }

  const updated = await store.updateReport(id, patch);

  // Audit log
  await store.createAuditLog({
    ticketId: id,
    uid: req.user.uid,
    action: 'STATUS_CHANGE',
    before: { status: prevStatus },
    after: { status: updated.status, note: noteText },
    reason: internalNote || 'Officer status change'
  });

  // Generate translated notification message for citizen
  if (report.language && report.language !== 'en') {
    await generateStatusMessage(updated, report.language);
  }

  res.json(updated);
}));

// Also support PATCH /api/staff/reports/:id
router.patch('/reports/:id', strictLimiter, validateBody(updateReportSchema), wrap(async (req, res) => {
  const id = req.params.id.toUpperCase();
  const report = await store.getReport(id);
  if (!report) throw httpError(404, 'Report not found.', 'NOT_FOUND');

  const { status, assignedTo, department, internalNote, publicNote, priority } = req.body;
  const now = new Date().toISOString();
  const patch = {};

  if (status && STATUSES.includes(status)) patch.status = status;
  if (assignedTo !== undefined) patch.assignedTo = assignedTo;
  if (department) patch.department = department;
  if (priority && PRIORITIES.includes(priority)) {
    patch.priority = priority;
    patch.dueAt = computeDueAt(priority);
  }

  if (publicNote || internalNote || status) {
    const timelineEntry = {
      status: patch.status || report.status,
      at: now,
      note: publicNote || internalNote || `Report updated by staff`,
      by: req.user.email || req.user.uid
    };
    patch.timeline = [...(report.timeline || []), timelineEntry];
  }

  const updated = await store.updateReport(id, patch);

  await store.createAuditLog({
    ticketId: id,
    uid: req.user.uid,
    action: 'REPORT_UPDATE',
    before: { status: report.status, assignedTo: report.assignedTo, priority: report.priority },
    after: patch,
    reason: internalNote || 'Staff update'
  });

  res.json(updated);
}));

// ── POST /api/staff/reports/:id/override ──────────────────────────────────────
router.post('/reports/:id/override', strictLimiter, validateBody(aiOverrideSchema), wrap(async (req, res) => {
  const id = req.params.id.toUpperCase();
  const report = await store.getReport(id);
  if (!report) throw httpError(404, 'Report not found.', 'NOT_FOUND');

  const { category, priority, reason } = req.body;
  const now = new Date().toISOString();

  const before = {
    category: report.category,
    priority: report.priority,
    department: report.department
  };

  const patch = {
    adminOverride: {
      overriddenBy: req.user.email || req.user.uid,
      overriddenAt: now,
      reason,
      originalCategory: report.category,
      originalPriority: report.priority
    }
  };

  if (category) {
    patch.category = category;
    patch.department = DEPARTMENTS[category] || report.department;
  }
  if (priority) {
    patch.priority = priority;
    patch.dueAt = computeDueAt(priority);
  }

  patch.timeline = [
    ...(report.timeline || []),
    {
      status: report.status,
      at: now,
      note: `Staff override: ${category ? 'Category → ' + category + '. ' : ''}${priority ? 'Priority → ' + priority + '. ' : ''}Reason: ${reason}`,
      by: req.user.email
    }
  ];

  const updated = await store.updateReport(id, patch);

  await store.createAuditLog({
    ticketId: id,
    uid: req.user.uid,
    action: 'AI_OVERRIDE',
    before,
    after: { category: updated.category, priority: updated.priority, department: updated.department },
    reason
  });

  res.json(updated);
}));

// ── POST /api/staff/reports/:id/assign ────────────────────────────────────────
router.post('/reports/:id/assign', strictLimiter, wrap(async (req, res) => {
  const id = req.params.id.toUpperCase();
  const report = await store.getReport(id);
  if (!report) throw httpError(404, 'Report not found.', 'NOT_FOUND');

  const { assignedTo, officerName } = req.body || {};
  const now = new Date().toISOString();

  const patch = {
    assignedTo: assignedTo || '',
    assignedOfficerName: officerName || assignedTo || ''
  };

  if (report.status === 'Received' || report.status === 'Under Review') {
    patch.status = 'Assigned';
  }

  patch.timeline = [
    ...(report.timeline || []),
    {
      status: patch.status || report.status,
      at: now,
      note: `Assigned to ${officerName || assignedTo || 'field officer'}`,
      by: req.user.email
    }
  ];

  const updated = await store.updateReport(id, patch);

  await store.createAuditLog({
    ticketId: id,
    uid: req.user.uid,
    action: 'ASSIGN_OFFICER',
    before: { assignedTo: report.assignedTo },
    after: { assignedTo: patch.assignedTo },
    reason: `Assigned to ${officerName || assignedTo}`
  });

  res.json(updated);
}));

// ── POST /api/staff/reports/:id/verify ────────────────────────────────────────
router.post('/reports/:id/verify', strictLimiter, wrap(async (req, res) => {
  const id = req.params.id.toUpperCase();
  const report = await store.getReport(id);
  if (!report) throw httpError(404, 'Report not found.', 'NOT_FOUND');

  const { afterImagePaths = [] } = req.body || {};
  const beforeImages = report.imagePaths || [];

  const verification = await verifyResolution(beforeImages, afterImagePaths);
  const now = new Date().toISOString();

  const patch = {
    afterImagePaths,
    resolutionVerification: {
      verified: verification.verified,
      reason: verification.reason,
      verifiedAt: now,
      verifiedBy: req.user.email
    }
  };

  if (verification.verified) {
    patch.status = 'Resolved';
    patch.timeline = [
      ...(report.timeline || []),
      {
        status: 'Resolved',
        at: now,
        note: `Issue resolved and verified by automated visual inspection: ${verification.reason}`,
        by: req.user.email
      }
    ];
  }

  const updated = await store.updateReport(id, patch);

  await store.createAuditLog({
    ticketId: id,
    uid: req.user.uid,
    action: 'RESOLUTION_VERIFICATION',
    before: { status: report.status },
    after: { verified: verification.verified, reason: verification.reason, status: updated.status },
    reason: verification.reason
  });

  res.json({
    verified: verification.verified,
    reason: verification.reason,
    report: updated
  });
}));

// ── GET /api/staff/reports/:id/audit ──────────────────────────────────────────
router.get('/reports/:id/audit', wrap(async (req, res) => {
  const id = req.params.id.toUpperCase();
  const report = await store.getReport(id);
  if (!report || (req.user.demo === true && report.department !== req.user.department)) {
    throw httpError(404, 'Report not found.', 'NOT_FOUND');
  }
  const logs = await store.getAuditLogs(id);
  res.json({ audit: logs });
}));

// ── Bulk Actions ──────────────────────────────────────────────────────────────
router.post('/reports/bulk-assign', strictLimiter, wrap(async (req, res) => {
  const { ids, assignedTo, officerName } = req.body || {};
  if (!Array.isArray(ids) || !ids.length) {
    throw httpError(400, 'ids must be a non-empty array.', 'BAD_REQUEST');
  }

  const now = new Date().toISOString();
  let count = 0;

  for (const id of ids.slice(0, 50)) {
    const report = await store.getReport(id);
    if (!report) continue;
    const patch = {
      assignedTo: assignedTo || '',
      assignedOfficerName: officerName || assignedTo || '',
      timeline: [
        ...(report.timeline || []),
        { status: report.status === 'Received' ? 'Assigned' : report.status, at: now, note: `Bulk assigned to ${officerName || assignedTo}` }
      ]
    };
    if (report.status === 'Received') patch.status = 'Assigned';
    await store.updateReport(id, patch);
    count++;
  }

  res.json({ ok: true, count });
}));

router.post('/reports/bulk-status', strictLimiter, wrap(async (req, res) => {
  const { ids, status, note } = req.body || {};
  if (!Array.isArray(ids) || !ids.length || !STATUSES.includes(status)) {
    throw httpError(400, 'Valid status and non-empty ids array required.', 'BAD_REQUEST');
  }

  const now = new Date().toISOString();
  let count = 0;

  for (const id of ids.slice(0, 50)) {
    const report = await store.getReport(id);
    if (!report) continue;
    const patch = {
      status,
      timeline: [
        ...(report.timeline || []),
        { status, at: now, note: note || `Bulk status set to ${status}`, by: req.user.email }
      ]
    };
    await store.updateReport(id, patch);
    count++;
  }

  res.json({ ok: true, count });
}));

// ── GET /api/staff/analytics ──────────────────────────────────────────────────
router.get('/analytics', wrap(async (_req, res) => {
  const { docs: all } = await store.listReports({}, { field: 'createdAt', dir: 'desc' }, { limit: 5000 });
  const total = all.length;
  const resolved = all.filter(r => r.status === 'Resolved');
  const resolutionRate = total ? Math.round((resolved.length / total) * 100) : 0;

  const now = new Date();
  const overdueCount = all.filter(r => r.status !== 'Resolved' && new Date(r.dueAt) < now).length;
  const slaCompliance = total ? Math.round(((total - overdueCount) / total) * 100) : 100;

  // AI Override rate
  const overridden = all.filter(r => !!r.adminOverride).length;
  const overrideRate = total ? Math.round((overridden / total) * 100) : 0;

  // Breakdown by department
  const byDept = all.reduce((m, r) => {
    m[r.department] = (m[r.department] || 0) + 1;
    return m;
  }, {});

  // Breakdown by ward
  const byWard = all.reduce((m, r) => {
    const w = r.ward || 'Central';
    m[w] = (m[w] || 0) + 1;
    return m;
  }, {});

  // Breakdown by category
  const byCat = all.reduce((m, r) => {
    m[r.category] = (m[r.category] || 0) + 1;
    return m;
  }, {});

  // 30-day resolution trend
  const dailyCounts = {};
  for (let d = 29; d >= 0; d--) {
    const dt = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
    dailyCounts[dt] = 0;
  }
  all.forEach(r => {
    const dt = (r.createdAt || '').slice(0, 10);
    if (dailyCounts[dt] !== undefined) dailyCounts[dt]++;
  });

  res.json({
    total,
    resolved: resolved.length,
    open: total - resolved.length,
    resolutionRate,
    slaCompliance,
    overrideRate,
    byDepartment: byDept,
    byWard: byWard,
    byCategory: byCat,
    trend: Object.entries(dailyCounts).map(([date, count]) => ({ date, count }))
  });
}));

// ── GET /api/staff/briefing ───────────────────────────────────────────────────
router.get('/briefing', strictLimiter, wrap(async (_req, res) => {
  const { docs: open } = await store.listReports({}, { field: 'createdAt', dir: 'desc' }, { limit: 100 });
  const openReports = open.filter(r => r.status !== 'Resolved');
  const briefing = await generateDailyBriefing(openReports);
  res.json(briefing);
}));

// ── POST /api/staff/search ────────────────────────────────────────────────────
router.post('/search', strictLimiter, validateBody(nlSearchSchema), wrap(async (req, res) => {
  const { query } = req.body;
  const { docs: all } = await store.listReports({}, { field: 'createdAt', dir: 'desc' }, { limit: 100 });
  const matched = await naturalLanguageSearch(query, all);
  res.json({ results: matched });
}));

// ── GET /api/staff/export ─────────────────────────────────────────────────────
router.get('/export', wrap(async (_req, res) => {
  const { docs: all } = await store.listReports({}, { field: 'createdAt', dir: 'desc' }, { limit: 5000 });
  const headers = ['ID', 'Title', 'Category', 'Priority', 'Department', 'Status', 'Location', 'Supporters', 'Created At', 'Due At'];
  const rows = all.map(r => [
    r.id,
    `"${(r.title || '').replace(/"/g, '""')}"`,
    `"${r.category || ''}"`,
    r.priority || '',
    `"${r.department || ''}"`,
    r.status || '',
    `"${(r.location || '').replace(/"/g, '""')}"`,
    r.supporters || 1,
    r.createdAt || '',
    r.dueAt || ''
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="civicresolve-reports.csv"');
  res.send(csv);
}));

// ── Admin-Only Endpoints ──────────────────────────────────────────────────────

// GET /api/staff/team
router.get('/team', requireAdmin, wrap(async (_req, res) => {
  const users = await store.listUsers();
  res.json({ users });
}));

// POST /api/staff/team/invite
router.post('/team/invite', requireAdmin, strictLimiter, wrap(async (req, res) => {
  const { email, role = 'officer', department = '', name = '' } = req.body || {};
  if (!email || !email.includes('@')) {
    throw httpError(400, 'Valid email required.', 'INVALID_EMAIL');
  }

  // Create Firebase user or Firestore record
  const uid = 'staff-' + Buffer.from(email).toString('hex').slice(0, 16);
  const created = await store.upsertUser(uid, {
    uid,
    email,
    name: name || email.split('@')[0],
    role: ['admin', 'officer'].includes(role) ? role : 'officer',
    department,
    status: 'active',
    createdAt: new Date().toISOString()
  });

  await store.createAuditLog({
    ticketId: 'STAFF_MGMT',
    uid: req.user.uid,
    action: 'INVITE_STAFF',
    before: null,
    after: { email, role, department },
    reason: `Admin invited staff user: ${email}`
  });

  res.status(201).json(created);
}));

// PUT /api/staff/team/:uid
router.put('/team/:uid', requireAdmin, wrap(async (req, res) => {
  const uid = req.params.uid;
  const { role, department, name } = req.body || {};
  const patch = {};
  if (role && ['citizen', 'officer', 'admin'].includes(role)) patch.role = role;
  if (department !== undefined) patch.department = department;
  if (name) patch.name = name;

  const updated = await store.upsertUser(uid, patch);

  await store.createAuditLog({
    ticketId: 'STAFF_MGMT',
    uid: req.user.uid,
    action: 'UPDATE_STAFF_ROLE',
    before: null,
    after: patch,
    reason: `Admin updated staff member ${uid}`
  });

  res.json(updated);
}));

// POST /api/staff/team/:uid/deactivate
router.post('/team/:uid/deactivate', requireAdmin, wrap(async (req, res) => {
  const uid = req.params.uid;
  const updated = await store.upsertUser(uid, { status: 'deactivated', deactivatedAt: new Date().toISOString() });
  res.json({ ok: true, user: updated });
}));

// Settings endpoints (admin only)
router.get('/settings', requireAdmin, wrap(async (_req, res) => {
  const slaConfig = (await store.getConfig('sla')) || SLA_HOURS;
  const deptConfig = (await store.getConfig('departments')) || CATEGORIES.map(c => ({ category: c, department: DEPARTMENTS[c] }));
  res.json({ sla: slaConfig, departments: deptConfig, categories: CATEGORIES });
}));

router.put('/settings/sla', requireAdmin, wrap(async (req, res) => {
  const sla = req.body;
  await store.setConfig('sla', sla);
  res.json({ ok: true, sla });
}));

router.put('/settings/departments', requireAdmin, wrap(async (req, res) => {
  const { departments } = req.body;
  await store.setConfig('departments', departments);
  res.json({ ok: true, departments });
}));

router.put('/settings/mapping', requireAdmin, wrap(async (req, res) => {
  const { mapping } = req.body;
  await store.setConfig('mapping', mapping);
  res.json({ ok: true, mapping });
}));

module.exports = router;
