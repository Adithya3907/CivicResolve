'use strict';
/**
 * @file server.js
 * Production-ready Express application factory for CivicResolve.
 */

if (process.env.NODE_ENV !== 'production') {
  try { require('dotenv').config(); } catch { /* ignore */ }
}

const express = require('express');
const session = require('express-session');
const path = require('path');
const crypto = require('crypto');

const { init: initFirebase } = require('./config/firebase-admin');
const { helmetMiddleware, compressionMiddleware, apiLimiter } = require('./middleware/security');
const { errorHandler } = require('./middleware/errorHandler');

const publicRoutes  = require('./routes/public');
const authRoutes    = require('./routes/auth');
const reportsRoutes = require('./routes/reports');
const staffRoutes   = require('./routes/staff');

const store = require('./services/store');
const { CATEGORIES, PRIORITIES, STATUSES, DEPARTMENTS, SLA_HOURS, computeDueAt } = require('./config/constants');
const { generateDailyBriefing } = require('./services/ai');
const { generateStatusMessage } = require('./services/notifications');

const SESSION_SECRET = process.env.SESSION_SECRET || 'civicresolve-secret-' + crypto.randomBytes(16).toString('hex');
const ADMIN_PASSWORD = () => process.env.ADMIN_PASSWORD || 'admin123';

const safeEq = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

const signHmac = exp => `${exp}.${crypto.createHmac('sha256', SESSION_SECRET).update(String(exp)).digest('hex')}`;
const validHmacToken = t => {
  const [exp] = String(t).split('.');
  return +exp > Date.now() && safeEq(String(t), signHmac(exp));
};

/**
 * Seed initial sample reports if database is empty.
 */
function seedInitialDataIfEmpty() {
  const ago = h => new Date(Date.now() - h * 3600000).toISOString();
  const samples = [
    {
      id: 'CR-1A2B3C',
      title: 'Deep pothole near bus stop',
      description: 'Large pothole on the right lane near the central bus shelter causing vehicular slowdown.',
      location: 'Avinashi Road, Coimbatore',
      category: 'Roads & Potholes',
      priority: 'High',
      department: 'Public Works Department',
      lat: 11.0252,
      lng: 76.9961,
      ward: 'Ward 12',
      language: 'en',
      status: 'In Progress',
      supporters: 14,
      imagePaths: [],
      createdAt: ago(30),
      dueAt: new Date(Date.now() - 30 * 36e5 + 72 * 36e5).toISOString(),
      timeline: [
        { status: 'Received', at: ago(30), note: 'Report received and triaged.' },
        { status: 'In Progress', at: ago(12), note: 'Road repair crew assigned to site.' }
      ]
    },
    {
      id: 'CR-4D5E6F',
      title: 'Open manhole on school route',
      description: 'Damaged concrete slab with open manhole pit directly adjacent to school pedestrian path.',
      location: 'RS Puram, Coimbatore',
      category: 'Water & Drainage',
      priority: 'Critical',
      department: 'Water Supply & Drainage Board',
      lat: 11.0183,
      lng: 76.9725,
      ward: 'Ward 08',
      language: 'en',
      status: 'Received',
      supporters: 28,
      imagePaths: [],
      createdAt: ago(5),
      dueAt: new Date(Date.now() - 5 * 36e5 + 24 * 36e5).toISOString(),
      timeline: [
        { status: 'Received', at: ago(5), note: 'High priority hazard logged for immediate inspection.' }
      ]
    },
    {
      id: 'CR-7A8B9C',
      title: 'Streetlight pole not functioning for 10 days',
      description: 'Three consecutive street lights out along the stretch, making junction unsafe at night.',
      location: 'Race Course Road, Coimbatore',
      category: 'Streetlights & Electrical',
      priority: 'Medium',
      department: 'Electricity Board',
      lat: 11.0067,
      lng: 76.9558,
      ward: 'Ward 15',
      language: 'en',
      status: 'Resolved',
      supporters: 6,
      imagePaths: [],
      createdAt: ago(60),
      dueAt: new Date(Date.now() - 60 * 36e5 + 168 * 36e5).toISOString(),
      timeline: [
        { status: 'Received', at: ago(60), note: 'Report logged.' },
        { status: 'In Progress', at: ago(40), note: 'Lineman dispatched.' },
        { status: 'Resolved', at: ago(2), note: 'Replacement ballast installed and verified.' }
      ]
    },
    {
      id: 'CR-0D1E2F',
      title: 'Overflowing municipal garbage container',
      description: 'Waste container has spilled onto roadway and sidewalk causing foul odor and health hazard.',
      location: 'Saibaba Colony, Coimbatore',
      category: 'Garbage & Sanitation',
      priority: 'High',
      department: 'Solid Waste Management',
      lat: 11.0305,
      lng: 76.9427,
      ward: 'Ward 22',
      language: 'en',
      status: 'Received',
      supporters: 9,
      imagePaths: [],
      createdAt: ago(14),
      dueAt: new Date(Date.now() - 14 * 36e5 + 72 * 36e5).toISOString(),
      timeline: [
        { status: 'Received', at: ago(14), note: 'Complaint queued for sanitation route.' }
      ]
    }
  ];

  if (store._mem) {
    if (store._mem.reports.size === 0) {
      for (const s of samples) {
        store._mem.reports.set(s.id, { ...s, _id: s.id, updatedAt: new Date().toISOString() });
      }
    }
    return;
  }

  store.listReports({}, null, { limit: 1, offset: 0 }).then(async ({ total }) => {
    if (total > 0) return;
    for (const s of samples) {
      await store.createReport(s);
    }
  }).catch(err => {
    console.warn('[server] Seed error:', err.message);
  });
}

/**
 * Creates and configures the Express application.
 * @returns {import('express').Application}
 */
function createApp() {
  initFirebase();

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // Security headers & compression
  app.use(helmetMiddleware);
  app.use(compressionMiddleware);

  // Body parsing
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: false, limit: '5mb' }));

  // Session
  app.use(session({
    name: 'cr_session',
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 14 * 86400000 // 14 days
    }
  }));

  // Global API rate limiting
  app.use('/api', apiLimiter);

  // Public routes (health, config, stats, public issues list)
  app.use(publicRoutes);

  // Auth routes (/api/auth)
  app.use('/api/auth', authRoutes);

  // Citizen grievance reporting routes (/api/reports)
  app.use('/api/reports', reportsRoutes);

  // Staff console routes (/api/staff)
  app.use('/api/staff', staffRoutes);

  // ── Backward-compatible endpoints & aliases for test suite ────────────────────
  app.post('/api/issues', async (req, res, next) => {
    try {
      // Mock citizen submission for tests or public report submit
      const v = req.body || {};
      const { distM, clean, fallbackAnalyze } = require('./config/constants');
      if (!v.title || v.title.length < 3) return res.status(400).json({ error: 'Title must be at least 3 characters.' });
      if (!v.description || v.description.length < 10) return res.status(400).json({ error: 'Please describe the issue in at least 10 characters.' });
      if (!v.location || v.location.length < 3) return res.status(400).json({ error: 'Location is required.' });

      if (v.image && (typeof v.image !== 'string' || v.image.length > 1500000 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v.image))) {
        return res.status(400).json({ error: 'Image must be a JPEG/PNG/WebP under ~1MB.' });
      }

      // Check duplicates
      if (v.lat != null && v.lng != null) {
        const { docs: all } = await store.listReports({}, null, { limit: 100 });
        const dup = all.find(i => i.status !== 'Resolved' && i.lat != null && distM(i.lat, i.lng, v.lat, v.lng) < 150);
        if (dup) {
          const supporters = await store.incrementSupporters(dup.id);
          const { ai, internalNotes, adminOverride, ...safe } = dup;
          return res.json({ duplicate: true, issue: { ...safe, supporters } });
        }
      }

      const initial = fallbackAnalyze(v);
      const now = new Date();
      const priority = initial.priority || 'Medium';
      const department = DEPARTMENTS[initial.category] || initial.department || 'Municipal Helpline';

      const newIssue = {
        title: clean(v.title, 120),
        description: clean(v.description, 2000),
        location: clean(v.location, 200),
        lat: v.lat ?? null,
        lng: v.lng ?? null,
        category: initial.category,
        priority,
        department,
        status: 'Reported',
        supporters: 1,
        createdAt: now.toISOString(),
        dueAt: new Date(+now + (SLA_HOURS[priority] || 72) * 36e5).toISOString(),
        timeline: [{ status: 'Reported', at: now.toISOString(), note: `Initial triage: ${priority} priority → ${department}` }]
      };

      const created = await store.createReport(newIssue);
      const { ai, internalNotes, adminOverride, ...safe } = created;
      res.status(201).json({ duplicate: false, issue: safe });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/issues/:id/support', async (req, res, next) => {
    try {
      const id = req.params.id.toUpperCase();
      const report = await store.getReport(id);
      if (!report) return res.status(404).json({ error: 'Ticket not found.' });
      const supporters = await store.incrementSupporters(id);
      res.json({ supporters });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/issues/:id/explain', async (req, res, next) => {
    try {
      const id = req.params.id.toUpperCase();
      const report = await store.getReport(id);
      if (!report) return res.status(404).json({ error: 'Ticket not found.' });
      const lang = req.query.lang || 'en';
      const result = await generateStatusMessage(report, lang);
      res.json({ text: result.text || `Ticket ${report.id} is ${report.status}.`, source: result.source });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/admin/login', (req, res) => {
    if (!safeEq(String(req.body?.password ?? ''), ADMIN_PASSWORD())) {
      return res.status(401).json({ error: 'Wrong password.' });
    }
    const token = signHmac(Date.now() + 8 * 36e5);
    res.json({ token });
  });

  const requireLegacyAdmin = (req, res, next) => {
    const auth = (req.get('authorization') || '').replace('Bearer ', '');
    if (validHmacToken(auth)) return next();
    return res.status(401).json({ error: 'Admin login required.' });
  };

  app.get('/api/admin/briefing', requireLegacyAdmin, async (_req, res, next) => {
    try {
      const { docs: all } = await store.listReports({}, null, { limit: 50 });
      const open = all.filter(r => r.status !== 'Resolved');
      const b = await generateDailyBriefing(open);
      res.json(b);
    } catch (err) {
      next(err);
    }
  });

  app.patch('/api/admin/issues/:id', requireLegacyAdmin, async (req, res, next) => {
    try {
      const id = req.params.id.toUpperCase();
      const report = await store.getReport(id);
      if (!report) return res.status(404).json({ error: 'Ticket not found.' });
      const status = req.body?.status;
      if (!['Reported', 'In Progress', 'Resolved', 'Received', 'Under Review', 'Assigned'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status.' });
      }
      const updatedTimeline = [
        ...(report.timeline || []),
        { status, at: new Date().toISOString(), note: req.body?.note || `Status set to ${status}` }
      ];
      const updated = await store.updateReport(id, { status, timeline: updatedTimeline });
      const { ai, internalNotes, adminOverride, ...safe } = updated;
      res.json(safe);
    } catch (err) {
      next(err);
    }
  });

  // Serve static files from public/ with appropriate caching headers
  app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '1h',
    setHeaders: (res, filePath) => {
      // Do not cache HTML files so SPA navigation stays fresh
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    }
  }));

  // API 404 handler
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Endpoint not found.', code: 'NOT_FOUND' });
  });

  // Central error handler
  app.use(errorHandler);

  // Seed default data if needed
  seedInitialDataIfEmpty();

  return app;
}

if (require.main === module) {
  const port = process.env.PORT || 8080;
  createApp().listen(port, () => {
    console.log(`CivicResolve server listening on port ${port}`);
  });
}

module.exports = { createApp };
