'use strict';
/**
 * @file routes/public.js
 * Public endpoints — no authentication required.
 */

const express = require('express');
const { CATEGORIES, PRIORITIES, STATUSES, LANGUAGE_CODES, SLA_HOURS } = require('../config/constants');
const store = require('../services/store');
const { validateQuery } = require('../middleware/validation');
const { listReportsQuerySchema } = require('../middleware/validation');
const { wrap } = require('../middleware/errorHandler');
const { generateStatusMessage } = require('../services/notifications');
const { z } = require('zod');

const router = express.Router();

// GET /healthz
router.get('/healthz', (_req, res) => res.json({ ok: true, timestamp: new Date().toISOString() }));

// GET /api/config — public app config (Firebase config, categories, etc.)
router.get('/api/config', (_req, res) => {
  res.json({
    ai: !!process.env.GEMINI_API_KEY,
    categories: CATEGORIES,
    priorities: PRIORITIES,
    statuses: STATUSES,
    supportedLanguages: LANGUAGE_CODES,
    slaHours: SLA_HOURS,
    firebase: {
      apiKey:            process.env.FIREBASE_API_KEY    || '',
      authDomain:        process.env.FIREBASE_AUTH_DOMAIN || '',
      projectId:         process.env.FIREBASE_PROJECT_ID  || 'civicresolve-dev',
      storageBucket:     process.env.GCS_BUCKET           || '',
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
      appId:             process.env.FIREBASE_APP_ID      || ''
    }
  });
});

// GET /api/stats
router.get('/api/stats', wrap(async (_req, res) => {
  const stats = await store.getStats();
  res.json(stats);
}));

// GET /api/issues — public paginated list (public view only: no PII, no image data)
router.get('/api/issues', validateQuery(listReportsQuerySchema), wrap(async (req, res) => {
  const q = req.query;
  const filters = {};
  if (q.status)   filters.status   = q.status;
  if (q.priority) filters.priority = q.priority;
  if (q.category) filters.category = q.category;
  if (q.overdue)  filters.overdue  = q.overdue;

  const sort = { field: q.sortBy || 'createdAt', dir: q.sortDir || 'desc' };
  const page = { limit: q.pageSize || 20, offset: 0 };

  const { docs, total } = await store.listReports(filters, sort, page);
  const publicDocs = docs.map(toPublicView);
  res.json({ issues: publicDocs, total, pageSize: page.limit });
}));

// GET /api/issues/:id — public view
router.get('/api/issues/:id', wrap(async (req, res) => {
  const issue = await store.getReport(req.params.id.toUpperCase());
  if (!issue) return res.status(404).json({ error: 'Ticket not found.', code: 'NOT_FOUND' });
  res.json(toPublicView(issue));
}));

// GET /api/issues/:id/status-message?lang=ta — translated status message
router.get('/api/issues/:id/status-message', wrap(async (req, res) => {
  const issue = await store.getReport(req.params.id.toUpperCase());
  if (!issue) return res.status(404).json({ error: 'Ticket not found.', code: 'NOT_FOUND' });
  const lang = String(req.query.lang || 'en').slice(0, 10);
  const { text, source } = await generateStatusMessage(issue, lang);
  res.json({ id: issue.id, status: issue.status, message: text, source, lang });
}));

/** Strip PII and internal fields from a report for public consumption. */
function toPublicView(r) {
  const { uid, phone, internalNotes, aiReasoning, embedding, ...pub } = r;
  return {
    ...pub,
    hasImages: !!(pub.imagePaths && pub.imagePaths.length)
  };
}

module.exports = router;
