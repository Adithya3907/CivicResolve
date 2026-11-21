'use strict';
/**
 * @file middleware/security.js
 * Helmet, compression, CSRF token, and rate limiters.
 */

const helmet      = require('helmet');
const compression = require('compression');
const rateLimit   = require('express-rate-limit');
const crypto      = require('crypto');

// ── Helmet with strict CSP ────────────────────────────────────────────────────
const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'self'"],
      scriptSrc:      ["'self'", 'https://www.gstatic.com', 'https://apis.google.com'],
      styleSrc:       ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc:        ["'self'", 'https://fonts.gstatic.com'],
      imgSrc:         ["'self'", 'data:', 'https://storage.googleapis.com', 'https://maps.gstatic.com', 'https://maps.googleapis.com'],
      connectSrc:     ["'self'", 'https://identitytoolkit.googleapis.com', 'https://securetoken.googleapis.com', 'https://firebaseinstallations.googleapis.com'],
      frameSrc:       ['https://maps.google.com', 'https://www.google.com'],
      objectSrc:      ["'none'"],
      baseUri:        ["'self'"],
      formAction:     ["'self'"],
      upgradeInsecureRequests: []
    }
  },
  hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
});

// ── Compression ───────────────────────────────────────────────────────────────
const compressionMiddleware = compression({ threshold: 1024 });

// ── Rate limiters ─────────────────────────────────────────────────────────────
/**
 * Create a rate limiter.
 * @param {number} max - requests per window
 * @param {number} [windowMs=60000]
 */
const makeRateLimit = (max, windowMs = 60_000) => rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({ error: 'Too many requests.', code: 'RATE_LIMITED' })
});

const apiLimiter     = makeRateLimit(120);
const strictLimiter  = makeRateLimit(15);
const authLimiter    = makeRateLimit(10, 60_000);
const uploadLimiter  = makeRateLimit(20, 60_000);

// ── CSRF ──────────────────────────────────────────────────────────────────────
const CSRF_TOKEN_LENGTH = 32;

/**
 * Generate a CSRF token and store it on the session.
 * @param {import('express').Request} req
 * @returns {string}
 */
function generateCsrfToken(req) {
  const token = crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
  if (req.session) req.session.csrfToken = token;
  return token;
}

/**
 * Middleware: verify CSRF token for state-mutating requests.
 * Reads from X-CSRF-Token header or _csrf body field.
 * Skipped for GET, HEAD, OPTIONS and for API routes that use Bearer auth.
 * @type {import('express').RequestHandler}
 */
function verifyCsrf(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  // Skip CSRF for Bearer-authenticated API calls (token is the CSRF mechanism)
  const auth = req.get('authorization') || '';
  if (auth.startsWith('Bearer ')) return next();

  const sessionToken = req.session && req.session.csrfToken;
  const requestToken = req.get('x-csrf-token') || req.body && req.body._csrf;
  if (!sessionToken || !requestToken) {
    return res.status(403).json({ error: 'Missing CSRF token.', code: 'CSRF_MISSING' });
  }
  const a = Buffer.from(sessionToken);
  const b = Buffer.from(requestToken);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(403).json({ error: 'Invalid CSRF token.', code: 'CSRF_INVALID' });
  }
  next();
}

module.exports = {
  helmetMiddleware,
  compressionMiddleware,
  makeRateLimit,
  apiLimiter,
  strictLimiter,
  authLimiter,
  uploadLimiter,
  generateCsrfToken,
  verifyCsrf
};
