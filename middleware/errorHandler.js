'use strict';
/**
 * @file middleware/errorHandler.js
 * Centralized error response shaping.
 * All API errors: { error: string, code?: string, details?: any }
 */

/**
 * Wrap an async route handler to forward errors to Express error pipeline.
 * @param {Function} fn
 * @returns {Function}
 */
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Express error handler middleware.
 * @type {import('express').ErrorRequestHandler}
 */
function errorHandler(err, req, res, _next) {
  // Zod validation errors
  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: 'Validation failed.',
      code: 'VALIDATION_ERROR',
      details: err.errors.map(e => ({ path: e.path.join('.'), message: e.message }))
    });
  }

  // Express JSON parse errors
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Payload too large.', code: 'PAYLOAD_TOO_LARGE' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON.', code: 'BAD_JSON' });
  }

  // HTTP errors with explicit status
  if (err.status && err.status < 500) {
    return res.status(err.status).json({ error: err.message || 'Bad request.', code: err.code });
  }

  // Log unexpected server errors (no PII)
  console.error('[error]', { path: req.path, method: req.method, message: err.message, stack: err.stack?.split('\n').slice(0, 4).join(' | ') });

  res.status(500).json({ error: 'An unexpected error occurred.', code: 'INTERNAL_ERROR' });
}

/**
 * Create an HTTP error object.
 * @param {number} status
 * @param {string} message
 * @param {string} [code]
 * @returns {Error & { status: number, code: string }}
 */
function httpError(status, message, code = '') {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

module.exports = { errorHandler, wrap, httpError };
