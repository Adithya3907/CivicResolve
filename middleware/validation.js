'use strict';
/**
 * @file middleware/validation.js
 * Zod schemas for all request bodies, with helpers.
 */

const { z } = require('zod');
const { CATEGORIES, LANGUAGE_CODES } = require('../config/constants');

// ── Shared primitives ─────────────────────────────────────────────────────────
const latitude   = z.number().min(-90).max(90).nullable().optional();
const longitude  = z.number().min(-180).max(180).nullable().optional();
const pageSize   = z.coerce.number().int().min(1).max(100).default(20);
const pageToken  = z.string().max(500).optional();

// ── Report submission ─────────────────────────────────────────────────────────
const submitReportSchema = z.object({
  title:       z.string().min(3,  'Title must be at least 3 characters.').max(120),
  description: z.string().min(10, 'Please describe the issue in at least 10 characters.').max(2000),
  location:    z.string().min(3,  'Location is required.').max(200),
  category:    z.enum(CATEGORIES).optional(),
  lat:         latitude,
  lng:         longitude,
  language:    z.string().max(10).optional().default('en'),
  ward:        z.string().max(80).optional(),
  phone:       z.string().max(20).optional()
}).strict();

// ── Image paths confirmation ──────────────────────────────────────────────────
const confirmImagesSchema = z.object({
  imagePaths: z.array(z.string().max(500)).min(1).max(5)
}).strict();

// ── Staff report update ───────────────────────────────────────────────────────
const updateReportSchema = z.object({
  status:         z.string().optional(),
  assignedTo:     z.string().max(128).optional(),
  department:     z.string().max(100).optional(),
  internalNote:   z.string().max(1000).optional(),
  publicNote:     z.string().max(500).optional(),
  priority:       z.enum(['Critical', 'High', 'Medium', 'Low']).optional()
}).strict().refine(d => Object.keys(d).length > 0, { message: 'At least one field required.' });

// ── AI override ───────────────────────────────────────────────────────────────
const aiOverrideSchema = z.object({
  category: z.enum(CATEGORIES).optional(),
  priority: z.enum(['Critical', 'High', 'Medium', 'Low']).optional(),
  reason:   z.string().min(10, 'Override reason must be at least 10 characters.').max(500)
}).strict().refine(d => d.category || d.priority, { message: 'At least category or priority must be provided.' });

// ── Auth session exchange ─────────────────────────────────────────────────────
const authSessionSchema = z.object({
  idToken: z.string().min(100, 'Invalid ID token.')
}).strict();

// ── Admin user management ─────────────────────────────────────────────────────
const setRoleSchema = z.object({
  role:       z.enum(['citizen', 'officer', 'admin']),
  department: z.string().max(100).optional().default('')
}).strict();

const createStaffSchema = z.object({
  email:      z.string().email(),
  name:       z.string().min(2).max(100),
  role:       z.enum(['citizen', 'officer', 'admin']).default('officer'),
  department: z.string().max(100).optional().default('')
}).strict();

// ── Config update ─────────────────────────────────────────────────────────────
const updateConfigSchema = z.object({
  slaHours:      z.record(z.number().int().positive()).optional(),
  routingRules:  z.record(z.string()).optional()
}).strict();

// ── List query params ─────────────────────────────────────────────────────────
const listReportsQuerySchema = z.object({
  status:     z.string().optional(),
  priority:   z.string().optional(),
  category:   z.string().optional(),
  department: z.string().optional(),
  ward:       z.string().optional(),
  overdue:    z.coerce.boolean().optional(),
  startDate:  z.string().datetime({ offset: true }).optional(),
  endDate:    z.string().datetime({ offset: true }).optional(),
  sortBy:     z.enum(['createdAt', 'priority', 'publicImpactScore']).optional().default('createdAt'),
  sortDir:    z.enum(['asc', 'desc']).optional().default('desc'),
  pageSize,
  pageToken
}).partial();

// ── NL search ────────────────────────────────────────────────────────────────
const nlSearchSchema = z.object({
  query: z.string().min(2).max(500)
}).strict();

// ── Validation middleware factory ─────────────────────────────────────────────
/**
 * Returns Express middleware that validates req.body with the given Zod schema.
 * On failure, calls next(zodError) which the error handler formats.
 * On success, replaces req.body with the parsed/coerced value.
 * @param {z.ZodTypeAny} schema
 * @returns {import('express').RequestHandler}
 */
function validateBody(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) return next(result.error);
    req.body = result.data;
    next();
  };
}

/**
 * Returns Express middleware that validates req.query with the given Zod schema.
 * @param {z.ZodTypeAny} schema
 * @returns {import('express').RequestHandler}
 */
function validateQuery(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) return next(result.error);
    req.query = result.data;
    next();
  };
}

module.exports = {
  submitReportSchema,
  confirmImagesSchema,
  updateReportSchema,
  aiOverrideSchema,
  authSessionSchema,
  setRoleSchema,
  createStaffSchema,
  updateConfigSchema,
  listReportsQuerySchema,
  nlSearchSchema,
  validateBody,
  validateQuery
};
