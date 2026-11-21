'use strict';
/**
 * @file middleware/auth.js
 * Firebase Auth token verification and role-based access control middleware.
 */

const { getAuth, IS_EMULATOR, isMemoryMode } = require('../config/firebase-admin');
const { httpError } = require('./errorHandler');
const store = require('../services/store');

/**
 * Extract Bearer token from Authorization header or session cookie.
 * @param {import('express').Request} req
 * @returns {string|null}
 */
function extractToken(req) {
  const authHeader = req.get('authorization') || '';
  if (authHeader.startsWith('Bearer ')) return authHeader.slice(7);
  if (req.session && req.session.idToken) return req.session.idToken;
  return null;
}

/**
 * Middleware: verify Firebase ID token, attach req.user = {uid, email, role, department}.
 * In emulator or test mode without a real token, allows a mock user via X-Mock-User header.
 * In real Firebase mode, ID tokens are strictly verified against Firebase Auth.
 * @type {import('express').RequestHandler}
 */
async function verifyToken(req, res, next) {
  // Test/Emulator mock user bypass (only when running in emulator or test memory mode)
  if ((IS_EMULATOR || isMemoryMode()) && req.get('x-mock-user')) {
    try {
      const mock = JSON.parse(req.get('x-mock-user'));
      req.user = { uid: mock.uid || 'mock-uid', email: mock.email || 'mock@dev.local', role: mock.role || 'citizen', department: mock.department || '' };
      return next();
    } catch { /* fall through to real auth */ }
  }

  const token = extractToken(req);
  if (!token) return next(httpError(401, 'Authentication required.', 'UNAUTHENTICATED'));

  try {
    const decoded = await getAuth().verifyIdToken(token, true /* checkRevoked */);
    // Load role and department from Firestore user record (custom claims fallback)
    const role       = decoded.role       || decoded['https://civicresolve/role']       || 'citizen';
    const department = decoded.department || decoded['https://civicresolve/department'] || '';
    req.user = { uid: decoded.uid, email: decoded.email || '', role, department, demo: decoded.demo === true };
    next();
  } catch (err) {
    if (err.code === 'auth/id-token-expired') return next(httpError(401, 'Token expired.', 'TOKEN_EXPIRED'));
    if (err.code === 'auth/id-token-revoked') return next(httpError(401, 'Token revoked.', 'TOKEN_REVOKED'));
    return next(httpError(401, 'Invalid token.', 'INVALID_TOKEN'));
  }
}

/**
 * Middleware factory: require the authenticated user to have one of the given roles.
 * Must be used AFTER verifyToken.
 * @param {...string} roles
 * @returns {import('express').RequestHandler}
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(httpError(401, 'Authentication required.', 'UNAUTHENTICATED'));
    if (!roles.includes(req.user.role)) return next(httpError(403, 'Insufficient permissions.', 'FORBIDDEN'));
    next();
  };
}

const requireCitizen = requireRole('citizen', 'officer', 'admin'); // citizens and above
const requireStaff   = requireRole('officer', 'admin');
const requireAdmin   = requireRole('admin');

module.exports = { verifyToken, requireRole, requireCitizen, requireStaff, requireAdmin };
