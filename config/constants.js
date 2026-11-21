'use strict';

/**
 * @file config/constants.js
 * Application-wide constants: categories, priorities, statuses, departments, SLA, languages.
 */

/** @type {string[]} All 12 civic issue categories */
const CATEGORIES = [
  'Roads & Potholes',
  'Garbage & Sanitation',
  'Streetlights & Electrical',
  'Water & Drainage',
  'Parks & Trees',
  'Traffic & Signals',
  'Sewage & Wastewater',
  'Public Property & Encroachment',
  'Noise & Air Pollution',
  'Animal & Pest Control',
  'Health & Hospitals',
  'Other'
];

/** @type {string[]} Priority levels, highest to lowest */
const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];

/** @type {string[]} All 5 lifecycle statuses */
const STATUSES = ['Received', 'Under Review', 'Assigned', 'In Progress', 'Resolved'];

/**
 * Maps each category to the responsible civic department.
 * @type {Object.<string, string>}
 */
const DEPARTMENTS = {
  'Roads & Potholes': 'Public Works Department',
  'Garbage & Sanitation': 'Solid Waste Management',
  'Streetlights & Electrical': 'Electricity Board',
  'Water & Drainage': 'Water Supply & Drainage Board',
  'Parks & Trees': 'Parks & Horticulture',
  'Traffic & Signals': 'Traffic Police',
  'Sewage & Wastewater': 'Water Supply & Drainage Board',
  'Public Property & Encroachment': 'Revenue & Town Planning',
  'Noise & Air Pollution': 'Pollution Control Board',
  'Animal & Pest Control': 'Animal Husbandry Department',
  'Health & Hospitals': 'Health Department',
  'Other': 'Municipal Helpline'
};

/**
 * SLA resolution time in hours for each priority.
 * @type {Object.<string, number>}
 */
const SLA_HOURS = {
  Critical: 24,
  High: 72,
  Medium: 168,
  Low: 336
};

/**
 * Returns the due date ISO string for a given priority.
 * @param {string} priority
 * @returns {string}
 */
function computeDueAt(priority) {
  const hours = SLA_HOURS[priority] || SLA_HOURS.Medium;
  return new Date(Date.now() + hours * 3600000).toISOString();
}

/**
 * Returns true if a report is overdue.
 * @param {{ dueAt: string, status: string }} report
 * @returns {boolean}
 */
function isOverdue(report) {
  return report.status !== 'Resolved' && new Date(report.dueAt) < new Date();
}

/** Supported ISO 639-1 / BCP-47 locale codes (23 Indian languages). */
const LANGUAGE_CODES = ['en', 'as', 'bn', 'brx', 'doi', 'gu', 'hi', 'kn', 'ks', 'kok', 'mai', 'ml', 'mni', 'mr', 'ne', 'or', 'pa', 'sa', 'sat', 'sd', 'ta', 'te', 'ur'];

/**
 * Keyword rules for fallback triage (no AI).
 * @type {Array<[string, RegExp]>}
 */
const RULES = [
  ['Roads & Potholes',           /pothole|road|crack|asphalt|footpath|pavement|bridge|speed ?breaker/i],
  ['Garbage & Sanitation',       /garbage|trash|waste|dustbin|bin|litter|dump|stink/i],
  ['Streetlights & Electrical',  /street ?light|lamp|electric|wire|pole|transformer|power|dark/i],
  ['Water & Drainage',           /water|leak|pipe|drain|manhole|flood|overflow|tap/i],
  ['Parks & Trees',              /park|tree|branch|garden|playground/i],
  ['Traffic & Signals',          /traffic|signal|junction|parking|jam|zebra/i],
  ['Sewage & Wastewater',        /sewage|sewer|septic|wastewater/i],
  ['Noise & Air Pollution',      /noise|sound|smoke|pollution|dust|fume/i],
  ['Animal & Pest Control',      /animal|dog|mosquito|rat|pest|stray/i],
  ['Health & Hospitals',         /hospital|clinic|ambulance|health|disease/i],
  ['Public Property & Encroachment', /encroach|illegal|construction|footpath blocked|building/i]
];

const URGENT_RE  = /open manhole|live wire|fallen (wire|pole|tree)|flood|accident|collapsed|gas leak|fire|injur|hospital|school|child|elderly|sparking/i;
const HIGH_RE    = /overflow|burst|blocked|no water|sewage|hazard|danger|night|main road|highway/i;
const LOW_RE     = /small|minor|paint|faded|cosmetic/i;

/**
 * Deterministic keyword-based fallback triage.
 * @param {{ title: string, description: string, category?: string }} v
 * @returns {{ category: string, subCategory: string, priority: string, confidence: number, publicImpactScore: number, recommendedDepartment: string, suggestedAction: string, reasoning: string, detectedLanguage: string, source: string }}
 */
function fallbackAnalyze(v) {
  const text = `${v.title} ${v.description}`;
  const hit = RULES.find(([, re]) => re.test(text));
  const category = (CATEGORIES.includes(v.category) ? v.category : null) || (hit ? hit[0] : 'Other');
  const priority = URGENT_RE.test(text) ? 'Critical' : HIGH_RE.test(text) ? 'High' : LOW_RE.test(text) ? 'Low' : 'Medium';
  return {
    category,
    subCategory: '',
    priority,
    confidence: hit ? 0.6 : 0.3,
    publicImpactScore: { Critical: 9, High: 7, Medium: 5, Low: 2 }[priority],
    recommendedDepartment: DEPARTMENTS[category],
    suggestedAction: 'Dispatch field team to inspect and report.',
    reasoning: 'Keyword-based triage (AI unavailable).',
    englishTranslation: '',
    detectedLanguage: 'en',
    spamFlag: false,
    textImageConsistency: 1.0,
    perImageFindings: [],
    source: 'rules'
  };
}

/**
 * Clean a string: strip control chars, trim, truncate.
 * @param {unknown} v
 * @param {number} max
 * @returns {string}
 */
const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);

/**
 * Parse a number within bounds, returning null if invalid.
 * @param {unknown} v
 * @param {number} lo
 * @param {number} hi
 * @returns {number|null}
 */
const num = (v, lo, hi) => (v !== '' && v !== null && v !== undefined && Number.isFinite(+v) && +v >= lo && +v <= hi ? +v : null);

/**
 * Haversine distance in metres.
 * @param {number} lat1 @param {number} lon1 @param {number} lat2 @param {number} lon2
 * @returns {number}
 */
const distM = (lat1, lon1, lat2, lon2) => {
  const R = 6371000, r = Math.PI / 180;
  const x = (lon2 - lon1) * r * Math.cos(((lat1 + lat2) / 2) * r);
  const y = (lat2 - lat1) * r;
  return Math.hypot(x, y) * R;
};

/**
 * Normalize an AI or fallback result to a consistent shape.
 * @param {Object} a - raw AI output
 * @param {{ category?: string }} v - original report (for fallback category)
 * @returns {Object}
 */
function normalize(a, v) {
  const category = CATEGORIES.includes(a.category) ? a.category : (CATEGORIES.includes(v.category) ? v.category : 'Other');
  const priority = PRIORITIES.includes(a.priority) ? a.priority : 'Medium';
  return {
    category,
    subCategory: clean(a.subCategory, 80),
    priority,
    department: DEPARTMENTS[category],
    confidence: Math.min(1, Math.max(0, Number(a.confidence) || 0)),
    publicImpactScore: Math.min(10, Math.max(1, Math.round(Number(a.publicImpactScore || a.publicImpact) || 5))),
    recommendedDepartment: DEPARTMENTS[category],
    suggestedAction: clean(a.suggestedAction, 240),
    reasoning: clean(a.reasoning, 400),
    englishTranslation: clean(a.englishTranslation, 2000),
    detectedLanguage: clean(a.detectedLanguage || a.language, 20) || 'en',
    spamFlag: !!a.spamFlag,
    textImageConsistency: Math.min(1, Math.max(0, Number(a.textImageConsistency) || 1)),
    perImageFindings: Array.isArray(a.perImageFindings) ? a.perImageFindings : [],
    source: a.source || 'gemini'
  };
}

module.exports = {
  CATEGORIES, PRIORITIES, STATUSES, DEPARTMENTS, SLA_HOURS, LANGUAGE_CODES,
  RULES, URGENT_RE, HIGH_RE,
  fallbackAnalyze, normalize, clean, num, distM, computeDueAt, isOverdue
};
