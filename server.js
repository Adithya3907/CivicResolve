'use strict';
const express = require('express'), helmet = require('helmet'), rateLimit = require('express-rate-limit');
const crypto = require('crypto'), path = require('path');
const store = require('./lib/store'), { analyze, explain, briefing } = require('./lib/ai');
const { STATUSES, SLA_HOURS, CATEGORIES, validate, distM, clean } = require('./lib/core');

const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const ADMIN_PASSWORD = () => process.env.ADMIN_PASSWORD || 'admin123';
const sign = exp => `${exp}.${crypto.createHmac('sha256', SECRET).update(String(exp)).digest('hex')}`;
const safeEq = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const validToken = t => { const [exp] = String(t).split('.'); return +exp > Date.now() && safeEq(String(t), sign(exp)); };
const requireAdmin = (req, res, next) => validToken((req.get('authorization') || '').replace('Bearer ', '')) ? next() : res.status(401).json({ error: 'Admin login required.' });
const publicView = ({ name, ...i }) => i; // never leak reporter name
const wrap = fn => (req, res, next) => fn(req, res).catch(next);

function createApp() {
  store.load();
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], imgSrc: ["'self'", 'data:'], frameSrc: ['https://maps.google.com', 'https://www.google.com'], objectSrc: ["'none'"] } } }));
  app.use(express.json({ limit: '2mb' }));
  const limit = max => rateLimit({ windowMs: 60_000, max, standardHeaders: true, legacyHeaders: false });
  app.use('/api', limit(120));
  const strict = limit(15);

  app.get('/healthz', (_, res) => res.json({ ok: true }));
  app.get('/api/config', (_, res) => res.json({ ai: !!process.env.GEMINI_API_KEY, categories: CATEGORIES }));

  app.post('/api/analyze', strict, wrap(async (req, res) => {
    const v = validate(req.body, true); if (v.error) return res.status(400).json({ error: v.error });
    res.json(await analyze(v.value));
  }));

  app.post('/api/issues', strict, wrap(async (req, res) => {
    const v = validate(req.body); if (v.error) return res.status(400).json({ error: v.error });
    const a = await analyze(v.value);
    if (v.value.lat !== null && v.value.lng !== null) { // duplicate detection: same category within 150 m, still open
      const dup = store.all().find(i => i.status !== 'Resolved' && i.category === a.category && i.lat !== null && distM(i.lat, i.lng, v.value.lat, v.value.lng) < 150);
      if (dup) { dup.supporters++; store.set(dup); return res.json({ duplicate: true, issue: publicView(dup) }); }
    }
    const now = new Date();
    const issue = { id: 'CR-' + crypto.randomBytes(3).toString('hex').toUpperCase(), ...v.value, ...a, supporters: 1, status: 'Reported', createdAt: now.toISOString(), dueAt: new Date(+now + SLA_HOURS[a.priority] * 36e5).toISOString(), timeline: [{ status: 'Reported', at: now.toISOString(), note: `AI triage (${a.source}): ${a.priority} priority → ${a.department}` }] };
    store.set(issue);
    res.status(201).json({ duplicate: false, issue: publicView(issue) });
  }));

  app.get('/api/issues', (req, res) => {
    const order = { Critical: 0, High: 1, Medium: 2, Low: 3 };
    const list = store.all().map(publicView).sort((a, b) => order[a.priority] - order[b.priority] || b.createdAt.localeCompare(a.createdAt));
    res.json(list.map(({ image, ...i }) => ({ ...i, hasImage: !!image })));
  });
  app.get('/api/issues/:id', (req, res) => { const i = store.get(req.params.id.toUpperCase()); i ? res.json(publicView(i)) : res.status(404).json({ error: 'Ticket not found.' }); });
  app.post('/api/issues/:id/support', strict, (req, res) => {
    const i = store.get(req.params.id.toUpperCase()); if (!i) return res.status(404).json({ error: 'Ticket not found.' });
    i.supporters++; store.set(i); res.json({ supporters: i.supporters });
  });

  app.get('/api/issues/:id/explain', strict, wrap(async (req, res) => {
    const i = store.get(req.params.id.toUpperCase()); if (!i) return res.status(404).json({ error: 'Ticket not found.' });
    res.json(await explain(i, ['English', 'Tamil', 'Hindi'].includes(req.query.lang) ? req.query.lang : 'English'));
  }));
  app.get('/api/admin/briefing', requireAdmin, strict, wrap(async (_req, res) => res.json(await briefing(store.all()))));

  app.get('/api/stats', (_, res) => {
    const all = store.all(), by = k => all.reduce((m, i) => ((m[i[k]] = (m[i[k]] || 0) + 1), m), {});
    const done = all.filter(i => i.status === 'Resolved');
    const hrs = done.map(i => (new Date(i.timeline.at(-1).at) - new Date(i.createdAt)) / 36e5);
    res.json({ total: all.length, resolved: done.length, open: all.length - done.length, overdue: all.filter(i => i.status !== 'Resolved' && new Date(i.dueAt) < new Date()).length, criticalOpen: all.filter(i => i.status !== 'Resolved' && i.priority === 'Critical').length, avgResolutionHours: hrs.length ? +(hrs.reduce((a, b) => a + b, 0) / hrs.length).toFixed(1) : null, byCategory: by('category'), byPriority: by('priority'), byStatus: by('status') });
  });

  app.post('/api/admin/login', strict, (req, res) => {
    if (!safeEq(String(req.body?.password ?? ''), ADMIN_PASSWORD())) return res.status(401).json({ error: 'Wrong password.' });
    res.json({ token: sign(Date.now() + 8 * 36e5) });
  });
  app.patch('/api/admin/issues/:id', requireAdmin, (req, res) => {
    const i = store.get(req.params.id.toUpperCase()); if (!i) return res.status(404).json({ error: 'Ticket not found.' });
    if (!STATUSES.includes(req.body?.status)) return res.status(400).json({ error: 'Invalid status.' });
    i.status = req.body.status;
    i.timeline.push({ status: i.status, at: new Date().toISOString(), note: clean(req.body.note, 200) || `Status set to ${i.status}` });
    store.set(i); res.json(publicView(i));
  });
  app.get('/api/admin/issues/:id/image', requireAdmin, (req, res) => { const i = store.get(req.params.id.toUpperCase()); res.json({ image: i?.image || '' }); });

  app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));
  app.use('/api', (_, res) => res.status(404).json({ error: 'Not found.' }));
  app.use((err, _req, res, _next) => { console.error(err); res.status(err.status || 500).json({ error: err.type === 'entity.too.large' ? 'Payload too large.' : 'Something went wrong.' }); });
  return app;
}
if (require.main === module) createApp().listen(process.env.PORT || 8080, () => console.log('CivicResolve running on :' + (process.env.PORT || 8080)));
module.exports = { createApp };
