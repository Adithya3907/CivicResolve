'use strict';
/**
 * @file services/store.js
 * Firestore abstraction with in-memory fallback for dev/tests.
 *
 * Modes:
 *   FIREBASE_EMULATOR=true + FIRESTORE_EMULATOR_HOST set → Firestore emulator
 *   FIREBASE_EMULATOR=true without FIRESTORE_EMULATOR_HOST → in-memory Map
 *   Production → real Firestore
 */

const crypto = require('crypto');
const { isMemoryMode } = require('../config/firebase-admin');
const USE_MEMORY = isMemoryMode();

// ── In-memory store (dev/test) ────────────────────────────────────────────────
const mem = {
  reports:            new Map(),
  users:              new Map(),
  departments:        new Map(),
  notifications:      new Map(),
  auditLogs:          new Map(),
  translationsCache:  new Map(),
  config:             new Map()
};

function memGet(col, id)      { return mem[col].get(id) || null; }
function memSet(col, id, doc) { mem[col].set(id, { ...doc, _id: id }); return { ...doc, _id: id }; }
function memAll(col)          { return [...mem[col].values()]; }
function memQuery(col, filters, sort, pagination) {
  let list = memAll(col);
  for (const [field, op, value] of filters) {
    list = list.filter(doc => {
      const dv = doc[field];
      if (op === '==')             return dv === value;
      if (op === 'in')             return Array.isArray(value) && value.includes(dv);
      if (op === '>=')             return dv >= value;
      if (op === '<=')             return dv <= value;
      if (op === 'array-contains') return Array.isArray(dv) && dv.includes(value);
      return true;
    });
  }
  if (sort) {
    const { field, dir } = sort;
    list.sort((a, b) => {
      const av = a[field], bv = b[field];
      return dir === 'desc' ? (av < bv ? 1 : av > bv ? -1 : 0) : (av > bv ? 1 : av < bv ? -1 : 0);
    });
  }
  const limit  = (pagination && pagination.limit)  || 20;
  const offset = (pagination && pagination.offset) || 0;
  return { docs: list.slice(offset, offset + limit), total: list.length };
}

// ── Firestore helpers ─────────────────────────────────────────────────────────
function getDb() {
  const { getDb } = require('../config/firebase-admin');
  return getDb();
}

async function fsGet(col, id) {
  const snap = await getDb().collection(col).doc(id).get();
  return snap.exists ? { _id: snap.id, ...snap.data() } : null;
}

async function fsSet(col, id, doc) {
  await getDb().collection(col).doc(id).set(doc, { merge: false });
  return { _id: id, ...doc };
}

async function fsUpdate(col, id, patch) {
  await getDb().collection(col).doc(id).update(patch);
  return fsGet(col, id);
}

async function fsCreate(col, doc) {
  const ref = await getDb().collection(col).add(doc);
  return { _id: ref.id, ...doc };
}

async function fsQuery(col, filters, sort, pagination) {
  let q = getDb().collection(col);
  for (const [field, op, value] of filters) {
    q = q.where(field, op, value);
  }
  if (sort) q = q.orderBy(sort.field, sort.dir || 'asc');
  const countSnap = await q.count().get();
  const total = countSnap.data().count;
  const limit  = (pagination && pagination.limit)  || 20;
  const offset = (pagination && pagination.offset) || 0;
  q = q.limit(limit).offset(offset);
  const snap = await q.get();
  const docs = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
  return { docs, total };
}

// ── Report ID generator ───────────────────────────────────────────────────────
function newReportId() {
  return 'CR-' + crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Create a new report.
 * @param {Object} data - validated report fields (no id)
 * @returns {Promise<Object>} created report
 */
async function createReport(data) {
  const id  = data.id || newReportId();
  const doc = { ...data, id, createdAt: data.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
  if (USE_MEMORY) return memSet('reports', id, doc);
  return fsSet('reports', id, doc);
}

/**
 * Get a report by ID.
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
async function getReport(id) {
  if (USE_MEMORY) return memGet('reports', id);
  return fsGet('reports', id);
}

/**
 * Update report fields (partial).
 * @param {string} id
 * @param {Object} patch
 * @returns {Promise<Object>}
 */
async function updateReport(id, patch) {
  patch.updatedAt = new Date().toISOString();
  if (USE_MEMORY) {
    const existing = memGet('reports', id);
    if (!existing) throw new Error(`Report ${id} not found`);
    return memSet('reports', id, { ...existing, ...patch });
  }
  return fsUpdate('reports', id, patch);
}

/**
 * List reports with filters and pagination.
 * @param {Object} filters - { status, priority, category, department, ward, overdue, startDate, endDate, uid }
 * @param {{ field: string, dir: string }} [sort]
 * @param {{ limit: number, offset: number }} [pagination]
 * @returns {Promise<{ docs: Object[], total: number }>}
 */
async function listReports(filters = {}, sort = { field: 'createdAt', dir: 'desc' }, pagination = { limit: 20, offset: 0 }) {
  const fArr = [];
  if (filters.status)     fArr.push(['status', '==', filters.status]);
  if (filters.priority)   fArr.push(['priority', '==', filters.priority]);
  if (filters.category)   fArr.push(['category', '==', filters.category]);
  if (filters.department) fArr.push(['department', '==', filters.department]);
  if (filters.ward)       fArr.push(['ward', '==', filters.ward]);
  if (filters.uid)        fArr.push(['uid', '==', filters.uid]);
  if (filters.startDate)  fArr.push(['createdAt', '>=', filters.startDate]);
  if (filters.endDate)    fArr.push(['createdAt', '<=', filters.endDate]);

  let result;
  if (USE_MEMORY) {
    result = memQuery('reports', fArr, sort, pagination);
  } else {
    result = await fsQuery('reports', fArr, sort, pagination);
  }

  if (filters.overdue) {
    const now = new Date().toISOString();
    result.docs = result.docs.filter(r => r.status !== 'Resolved' && r.dueAt < now);
    result.total = result.docs.length;
  }

  return result;
}

/**
 * Get all reports submitted by a specific user.
 * @param {string} uid
 * @returns {Promise<Object[]>}
 */
async function getUserReports(uid) {
  const { docs } = await listReports({ uid }, { field: 'createdAt', dir: 'desc' }, { limit: 100, offset: 0 });
  return docs;
}

/**
 * Increment supporters count atomically (best-effort in memory mode).
 * @param {string} id
 * @returns {Promise<number>}
 */
async function incrementSupporters(id) {
  if (USE_MEMORY) {
    const r = memGet('reports', id);
    if (!r) throw new Error('Report not found');
    r.supporters = (r.supporters || 1) + 1;
    memSet('reports', id, r);
    return r.supporters;
  }
  const { FieldValue } = require('firebase-admin/firestore');
  await getDb().collection('reports').doc(id).update({ supporters: FieldValue.increment(1) });
  const snap = await getDb().collection('reports').doc(id).get();
  return snap.data().supporters;
}

// ── Audit log ─────────────────────────────────────────────────────────────────

/**
 * Write an audit log entry.
 * @param {Object} entry - { uid, ticketId, action, before, after, reason }
 * @returns {Promise<Object>}
 */
async function createAuditLog(entry) {
  const doc = { ...entry, createdAt: new Date().toISOString() };
  if (USE_MEMORY) {
    const id = crypto.randomUUID();
    return memSet('auditLogs', id, doc);
  }
  return fsCreate('auditLogs', doc);
}

/**
 * Get audit log entries for a ticket.
 * @param {string} ticketId
 * @returns {Promise<Object[]>}
 */
async function getAuditLogs(ticketId) {
  if (USE_MEMORY) return memAll('auditLogs').filter(l => l.ticketId === ticketId);
  const { docs } = await fsQuery('auditLogs', [['ticketId', '==', ticketId]], { field: 'createdAt', dir: 'asc' }, { limit: 200, offset: 0 });
  return docs;
}

// ── Translation cache ─────────────────────────────────────────────────────────

/**
 * Get a cached translation.
 * @param {string} key - e.g. `${ticketId}:${lang}`
 * @returns {Promise<string|null>}
 */
async function getTranslationCache(key) {
  if (USE_MEMORY) { const r = memGet('translationsCache', key); return r ? r.text : null; }
  const doc = await fsGet('translationsCache', key);
  return doc ? doc.text : null;
}

/**
 * Store a translation in cache.
 * @param {string} key
 * @param {string} text
 * @returns {Promise<void>}
 */
async function setTranslationCache(key, text) {
  const doc = { text, cachedAt: new Date().toISOString() };
  if (USE_MEMORY) { memSet('translationsCache', key, doc); return; }
  await getDb().collection('translationsCache').doc(key).set(doc);
}

// ── Config ────────────────────────────────────────────────────────────────────

/**
 * Get a config document.
 * @param {string} key
 * @returns {Promise<Object|null>}
 */
async function getConfig(key) {
  if (USE_MEMORY) return memGet('config', key);
  return fsGet('config', key);
}

/**
 * Set a config document.
 * @param {string} key
 * @param {Object} value
 * @returns {Promise<Object>}
 */
async function setConfig(key, value) {
  if (USE_MEMORY) return memSet('config', key, value);
  return fsSet('config', key, value);
}

// ── User management ───────────────────────────────────────────────────────────

/**
 * Get a user document by uid.
 * @param {string} uid
 * @returns {Promise<Object|null>}
 */
async function getUser(uid) {
  if (USE_MEMORY) return memGet('users', uid);
  return fsGet('users', uid);
}

/**
 * Upsert a user document.
 * @param {string} uid
 * @param {Object} data
 * @returns {Promise<Object>}
 */
async function upsertUser(uid, data) {
  const doc = { ...data, updatedAt: new Date().toISOString() };
  if (USE_MEMORY) {
    const existing = memGet('users', uid) || {};
    return memSet('users', uid, { ...existing, ...doc });
  }
  await getDb().collection('users').doc(uid).set(doc, { merge: true });
  return getUser(uid);
}

/**
 * Get all users (admin only).
 * @returns {Promise<Object[]>}
 */
async function listUsers() {
  if (USE_MEMORY) return memAll('users');
  const { docs } = await fsQuery('users', [], { field: 'createdAt', dir: 'desc' }, { limit: 500, offset: 0 });
  return docs;
}

// ── Department management ─────────────────────────────────────────────────────

/**
 * List all departments.
 * @returns {Promise<Object[]>}
 */
async function listDepartments() {
  if (USE_MEMORY) return memAll('departments');
  const { docs } = await fsQuery('departments', [], null, { limit: 100, offset: 0 });
  return docs;
}

/**
 * Upsert a department.
 * @param {string} id
 * @param {Object} data
 * @returns {Promise<Object>}
 */
async function upsertDepartment(id, data) {
  if (USE_MEMORY) return memSet('departments', id, data);
  await getDb().collection('departments').doc(id).set(data, { merge: true });
  return fsGet('departments', id);
}

// ── Stats ─────────────────────────────────────────────────────────────────────

/**
 * Compute aggregated statistics over all reports.
 * @returns {Promise<Object>}
 */
async function getStats() {
  const { docs: all } = await listReports({}, { field: 'createdAt', dir: 'desc' }, { limit: 10000, offset: 0 });
  const resolved = all.filter(r => r.status === 'Resolved');
  const now = new Date();
  const hrs = resolved.map(r => {
    const timeline = r.timeline || [];
    const resolvedEntry = [...timeline].reverse().find(t => t.status === 'Resolved');
    return resolvedEntry ? (new Date(resolvedEntry.at) - new Date(r.createdAt)) / 3600000 : 0;
  });
  const byKey = k => all.reduce((m, r) => { m[r[k]] = (m[r[k]] || 0) + 1; return m; }, {});

  return {
    total:              all.length,
    resolved:           resolved.length,
    open:               all.length - resolved.length,
    overdue:            all.filter(r => r.status !== 'Resolved' && new Date(r.dueAt) < now).length,
    criticalOpen:       all.filter(r => r.status !== 'Resolved' && r.priority === 'Critical').length,
    avgResolutionHours: hrs.length ? +(hrs.reduce((a, b) => a + b, 0) / hrs.length).toFixed(1) : null,
    byCategory:         byKey('category'),
    byPriority:         byKey('priority'),
    byStatus:           byKey('status'),
    byDepartment:       byKey('department')
  };
}

// Token budget (simple Firestore counter for Gemini API budget)
async function getTokenBudget(date = new Date().toISOString().slice(0, 10)) {
  const doc = await getConfig(`budgets/${date}`);
  return doc ? doc.tokensUsed : 0;
}

async function incrementTokenBudget(tokens, date = new Date().toISOString().slice(0, 10)) {
  if (USE_MEMORY) {
    const doc = memGet('config', `budgets/${date}`) || { tokensUsed: 0 };
    doc.tokensUsed = (doc.tokensUsed || 0) + tokens;
    memSet('config', `budgets/${date}`, doc);
    return doc.tokensUsed;
  }
  const { FieldValue } = require('firebase-admin/firestore');
  const ref = getDb().collection('config').doc(`budgets/${date}`);
  await ref.set({ tokensUsed: FieldValue.increment(tokens) }, { merge: true });
  const snap = await ref.get();
  return snap.data().tokensUsed;
}

module.exports = {
  createReport, getReport, updateReport, listReports, getUserReports, incrementSupporters,
  createAuditLog, getAuditLogs,
  getTranslationCache, setTranslationCache,
  getConfig, setConfig,
  getUser, upsertUser, listUsers,
  listDepartments, upsertDepartment,
  getStats,
  getTokenBudget, incrementTokenBudget,
  // For testing: expose mem store
  _mem: USE_MEMORY ? mem : null
};
