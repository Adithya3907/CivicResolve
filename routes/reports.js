'use strict';
/**
 * @file routes/reports.js
 * Citizen grievance reporting endpoints.
 * All citizen actions require authentication.
 */

const express = require('express');
const { CATEGORIES, PRIORITIES, DEPARTMENTS, SLA_HOURS, computeDueAt, distM, clean, fallbackAnalyze, normalize } = require('../config/constants');
const store = require('../services/store');
const { triage, generateEmbedding } = require('../services/ai');
const { enqueue, registerHandler } = require('../services/queue');
const { getSignedUploadUrl, getSignedReadUrl, validateMagicBytes, LOCAL_UPLOAD_DIR } = require('../services/storage');
const { verifyToken, requireCitizen } = require('../middleware/auth');
const { validateBody, submitReportSchema, confirmImagesSchema } = require('../middleware/validation');
const { strictLimiter, uploadLimiter } = require('../middleware/security');
const { wrap, httpError } = require('../middleware/errorHandler');
const path = require('path');
const fs = require('fs');

const router = express.Router();

/**
 * Strips PII and staff-only AI details before returning to citizen.
 * @param {Object} report
 * @returns {Object}
 */
function citizenView(report) {
  if (!report) return null;
  const {
    ai,
    internalNotes,
    adminOverride,
    spamFlag,
    textImageConsistency,
    perImageFindings,
    ...safe
  } = report;
  return safe;
}

// ── Register background triage handler ────────────────────────────────────────
registerHandler('triage', async (payload) => {
  const { reportId } = payload;
  const report = await store.getReport(reportId);
  if (!report) return;

  try {
    const aiResult = await triage(report);
    const now = new Date().toISOString();

    const patch = {
      category: aiResult.category || report.category,
      priority: aiResult.priority || report.priority,
      department: aiResult.recommendedDepartment || aiResult.department || report.department,
      publicImpactScore: aiResult.publicImpactScore || report.publicImpactScore || 5,
      detectedLanguage: aiResult.detectedLanguage || report.language || 'en',
      englishTranslation: aiResult.englishTranslation || report.description,
      ai: {
        category: aiResult.category,
        subCategory: aiResult.subCategory || '',
        priority: aiResult.priority,
        publicImpactScore: aiResult.publicImpactScore,
        confidence: aiResult.confidence,
        recommendedDepartment: aiResult.recommendedDepartment || aiResult.department,
        suggestedAction: aiResult.suggestedAction,
        reasoning: aiResult.reasoning,
        perImageFindings: aiResult.perImageFindings || [],
        textImageConsistency: aiResult.textImageConsistency ?? 1,
        spamFlag: !!aiResult.spamFlag,
        source: aiResult.source || 'gemini',
        model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
        version: '2.0.0',
        triagedAt: now
      },
      dueAt: computeDueAt(aiResult.priority || report.priority)
    };

    // If report is still in initial Received status, transition to Under Review
    if (report.status === 'Received') {
      patch.status = 'Under Review';
      patch.timeline = [
        ...(report.timeline || []),
        {
          status: 'Under Review',
          at: now,
          note: `Complaint reviewed. Categorized as ${patch.category} and routed to ${patch.department}.`
        }
      ];
    }

    await store.updateReport(reportId, patch);
    console.log(`[queue] Triage complete for ${reportId} (${patch.priority} → ${patch.department})`);
  } catch (err) {
    console.error(`[queue] Triage error for ${reportId}:`, err.message);
  }
});

// ── Citizen Endpoints ─────────────────────────────────────────────────────────

// POST /api/reports — Citizen submit new report
router.post('/', verifyToken, requireCitizen, strictLimiter, validateBody(submitReportSchema), wrap(async (req, res) => {
  const v = req.body;
  const uid = req.user.uid;
  const now = new Date();

  // 1. Duplicate detection: check nearby active reports within 150m with same category
  if (v.lat != null && v.lng != null) {
    const { docs: activeReports } = await store.listReports({}, { field: 'createdAt', dir: 'desc' }, { limit: 100 });
    const duplicate = activeReports.find(r =>
      r.status !== 'Resolved' &&
      r.lat != null &&
      r.lng != null &&
      (v.category ? r.category === v.category : true) &&
      distM(r.lat, r.lng, v.lat, v.lng) < 150
    );

    if (duplicate) {
      const supporters = await store.incrementSupporters(duplicate.id);
      // Audit log the duplicate link
      await store.createAuditLog({
        ticketId: duplicate.id,
        uid,
        action: 'DUPLICATE_LINK',
        reason: `Linked report from user at (${v.lat.toFixed(4)}, ${v.lng.toFixed(4)})`,
        before: { supporters: supporters - 1 },
        after: { supporters }
      });

      return res.status(200).json({
        duplicate: true,
        message: 'This issue was already reported nearby. Your report has been added to it.',
        issue: citizenView({ ...duplicate, supporters })
      });
    }
  }

  // 2. Initial synchronous deterministic fallback so report has immediate routing
  const initial = fallbackAnalyze({
    title: v.title,
    description: v.description,
    category: v.category,
    location: v.location
  });

  const department = v.category && DEPARTMENTS[v.category] ? DEPARTMENTS[v.category] : (initial.department || 'Municipal Helpline');
  const priority = initial.priority || 'Medium';
  const dueAt = computeDueAt(priority);

  const newReportData = {
    uid,
    title: v.title,
    description: v.description,
    location: v.location,
    category: v.category || initial.category,
    priority,
    department,
    lat: v.lat ?? null,
    lng: v.lng ?? null,
    ward: v.ward || '',
    language: v.language || 'en',
    phone: v.phone || '',
    status: 'Received',
    supporters: 1,
    imagePaths: [],
    dueAt,
    timeline: [
      {
        status: 'Received',
        at: now.toISOString(),
        note: `Grievance registered and routed to ${department}.`
      }
    ]
  };

  const created = await store.createReport(newReportData);

  // 3. Enqueue background Gemini multimodal triage (invisible to citizen)
  await enqueue('triage', { reportId: created.id, uid });

  res.status(201).json({
    duplicate: false,
    ticketId: created.id,
    department: created.department,
    expectedResponseHours: SLA_HOURS[created.priority] || 72,
    issue: citizenView(created)
  });
}));

// GET /api/reports/mine — Citizen's own submitted reports
router.get('/mine', verifyToken, requireCitizen, wrap(async (req, res) => {
  const reports = await store.getUserReports(req.user.uid);
  res.json({ reports: reports.map(citizenView) });
}));

// POST /api/reports/:id/support — "I am affected too"
router.post('/:id/support', strictLimiter, wrap(async (req, res) => {
  const id = req.params.id.toUpperCase();
  const report = await store.getReport(id);
  if (!report) throw httpError(404, 'Ticket not found.', 'NOT_FOUND');

  const supporters = await store.incrementSupporters(id);
  res.json({ id, supporters });
}));

// POST /api/reports/:id/escalate — Escalate report after SLA breach
router.post('/:id/escalate', verifyToken, requireCitizen, strictLimiter, wrap(async (req, res) => {
  const id = req.params.id.toUpperCase();
  const report = await store.getReport(id);
  if (!report) throw httpError(404, 'Ticket not found.', 'NOT_FOUND');

  // Check if overdue or close to SLA
  const isPastSla = new Date(report.dueAt) < new Date();
  if (!isPastSla && report.status === 'Resolved') {
    throw httpError(400, 'This issue has already been resolved.', 'ALREADY_RESOLVED');
  }

  const now = new Date().toISOString();
  const updatedTimeline = [
    ...(report.timeline || []),
    {
      status: report.status,
      at: now,
      note: 'Citizen requested escalation due to SLA timeline.'
    }
  ];

  await store.updateReport(id, {
    escalated: true,
    escalatedAt: now,
    timeline: updatedTimeline
  });

  await store.createAuditLog({
    ticketId: id,
    uid: req.user.uid,
    action: 'CITIZEN_ESCALATE',
    reason: 'Citizen escalated overdue ticket',
    before: { escalated: false },
    after: { escalated: true }
  });

  res.json({ ok: true, message: 'Ticket escalated to administrative supervisor.' });
}));

// POST /api/reports/:id/images/upload-url — Request signed upload URL
router.post('/:id/images/upload-url', verifyToken, requireCitizen, uploadLimiter, wrap(async (req, res) => {
  const id = req.params.id.toUpperCase();
  const report = await store.getReport(id);
  if (!report) throw httpError(404, 'Ticket not found.', 'NOT_FOUND');
  if (report.uid !== req.user.uid && req.user.role === 'citizen') {
    throw httpError(403, 'Permission denied.', 'FORBIDDEN');
  }

  const { mimeType = 'image/jpeg', filename = 'photo.jpg' } = req.body || {};
  const { uploadUrl, objectPath } = await getSignedUploadUrl(id, mimeType, filename);

  res.json({ uploadUrl, objectPath });
}));

// POST /api/reports/:id/images/confirm — Confirm uploaded images and trigger re-triage
router.post('/:id/images/confirm', verifyToken, requireCitizen, validateBody(confirmImagesSchema), wrap(async (req, res) => {
  const id = req.params.id.toUpperCase();
  const report = await store.getReport(id);
  if (!report) throw httpError(404, 'Ticket not found.', 'NOT_FOUND');
  if (report.uid !== req.user.uid && req.user.role === 'citizen') {
    throw httpError(403, 'Permission denied.', 'FORBIDDEN');
  }

  const { imagePaths } = req.body;
  const existing = report.imagePaths || [];
  const merged = [...new Set([...existing, ...imagePaths])].slice(0, 5);

  await store.updateReport(id, { imagePaths: merged });

  // Re-run multimodal triage with newly attached images
  await enqueue('triage', { reportId: id, uid: req.user.uid });

  res.json({ ok: true, imageCount: merged.length });
}));

// Direct upload fallback for local development / testing
router.post('/:id/images/upload-direct', uploadLimiter, wrap(async (req, res) => {
  const objectPath = req.query.path;
  if (!objectPath || typeof objectPath !== 'string') {
    throw httpError(400, 'Missing path parameter.', 'INVALID_PATH');
  }

  const targetFile = path.join(LOCAL_UPLOAD_DIR, path.basename(objectPath));
  const writeStream = fs.createWriteStream(targetFile);
  req.pipe(writeStream);

  writeStream.on('finish', () => {
    res.json({ ok: true, objectPath });
  });
  writeStream.on('error', (err) => {
    res.status(500).json({ error: 'Failed to write image.', details: err.message });
  });
}));

// View local uploaded image (fallback)
router.get('/images/view', wrap(async (req, res) => {
  const objectPath = req.query.path;
  if (!objectPath || typeof objectPath !== 'string') {
    return res.status(404).send('Not found');
  }
  const targetFile = path.join(LOCAL_UPLOAD_DIR, path.basename(objectPath));
  if (fs.existsSync(targetFile)) {
    return res.sendFile(targetFile);
  }
  res.status(404).send('Image not found');
}));

module.exports = router;
