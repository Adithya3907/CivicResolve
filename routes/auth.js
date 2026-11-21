'use strict';
/**
 * @file routes/auth.js
 * Firebase Auth session endpoints.
 */

const express = require('express');
const { getAuth, IS_EMULATOR } = require('../config/firebase-admin');
const { upsertUser, getUser } = require('../services/store');
const { validateBody } = require('../middleware/validation');
const { authSessionSchema } = require('../middleware/validation');
const { verifyToken } = require('../middleware/auth');
const { wrap, httpError } = require('../middleware/errorHandler');
const { authLimiter } = require('../middleware/security');

const router = express.Router();

const SESSION_COOKIE_NAME = 'cr_session';
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 14 * 1000; // 14 days

// POST /api/auth/session — exchange Firebase ID token for session cookie
router.post('/session', authLimiter, validateBody(authSessionSchema), wrap(async (req, res) => {
  const { idToken } = req.body;
  let decoded;
  try {
    decoded = await getAuth().verifyIdToken(idToken, true);
  } catch (err) {
    throw httpError(401, 'Invalid or expired ID token.', 'INVALID_TOKEN');
  }

  const uid   = decoded.uid;
  const email = decoded.email || '';
  const role  = decoded.role  || decoded['https://civicresolve/role'] || 'citizen';
  const dept  = decoded.department || '';

  // Store/update user profile in Firestore (no PII logged)
  await upsertUser(uid, { uid, email, role, department: dept, lastLogin: new Date().toISOString() });

  // Store token in session for server-side verification
  req.session.idToken    = idToken;
  req.session.uid        = uid;
  req.session.role       = role;
  req.session.department = dept;

  res.json({ ok: true, uid, role, department: dept });
}));

// POST /api/auth/logout
router.post('/logout', wrap(async (req, res) => {
  if (req.session) {
    req.session.destroy(() => {});
  }
  res.clearCookie(SESSION_COOKIE_NAME);
  res.json({ ok: true });
}));

// GET /api/auth/me — return current user info (requires auth)
router.get('/me', verifyToken, wrap(async (req, res) => {
  const profile = await getUser(req.user.uid);
  res.json({ uid: req.user.uid, role: req.user.role, department: req.user.department, profile: profile || {} });
}));

module.exports = router;
