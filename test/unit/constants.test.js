'use strict';
/**
 * @file test/unit/constants.test.js
 * Unit tests for municipal constants, categories, SLA calculations, and fallback triage rules.
 */

const test = require('node:test');
const assert = require('node:assert');
const {
  CATEGORIES,
  PRIORITIES,
  STATUSES,
  DEPARTMENTS,
  SLA_HOURS,
  computeDueAt,
  isOverdue,
  distM,
  fallbackAnalyze,
  clean,
  LANGUAGE_CODES
} = require('../../config/constants');

test('constants are well defined', () => {
  assert.equal(CATEGORIES.length, 12);
  assert.deepEqual(PRIORITIES, ['Critical', 'High', 'Medium', 'Low']);
  assert.deepEqual(STATUSES, ['Received', 'Under Review', 'Assigned', 'In Progress', 'Resolved']);
  assert.equal(LANGUAGE_CODES.length, 23);

  // Every category maps to a responsible department
  for (const cat of CATEGORIES) {
    assert.ok(DEPARTMENTS[cat], `Category ${cat} must map to a department`);
    assert.ok(typeof DEPARTMENTS[cat] === 'string');
  }

  // SLA hours exist for all priorities
  assert.equal(SLA_HOURS.Critical, 24);
  assert.equal(SLA_HOURS.High, 72);
  assert.equal(SLA_HOURS.Medium, 168);
  assert.equal(SLA_HOURS.Low, 336);
});

test('computeDueAt calculates future timestamps based on SLA', () => {
  const now = Date.now();
  const criticalDue = new Date(computeDueAt('Critical')).getTime();
  const highDue = new Date(computeDueAt('High')).getTime();
  const mediumDue = new Date(computeDueAt('Medium')).getTime();

  // Tolerance of 2 seconds
  assert.ok(criticalDue - now >= 24 * 36e5 - 2000);
  assert.ok(highDue - now >= 72 * 36e5 - 2000);
  assert.ok(mediumDue - now >= 168 * 36e5 - 2000);
});

test('isOverdue correctly flags past SLA reports', () => {
  const past = new Date(Date.now() - 36e5).toISOString();
  const future = new Date(Date.now() + 36e5).toISOString();

  assert.equal(isOverdue({ status: 'Received', dueAt: past }), true);
  assert.equal(isOverdue({ status: 'In Progress', dueAt: past }), true);
  assert.equal(isOverdue({ status: 'Resolved', dueAt: past }), false); // Resolved is never overdue
  assert.equal(isOverdue({ status: 'Received', dueAt: future }), false);
});

test('distM calculates ground distances accurately', () => {
  // Same point
  assert.equal(distM(11.0, 77.0, 11.0, 77.0), 0);
  // ~111 meters for 0.001 deg latitude
  const d = distM(11.0, 77.0, 11.001, 77.0);
  assert.ok(d > 100 && d < 120);
});

test('fallbackAnalyze categorizes text and assesses urgency', () => {
  const pothole = fallbackAnalyze({ title: 'Big pothole', description: 'Deep crater on the road' });
  assert.equal(pothole.category, 'Roads & Potholes');
  assert.ok(['High', 'Medium'].includes(pothole.priority));

  const manhole = fallbackAnalyze({ title: 'Open manhole', description: 'Fallen live wire and open manhole near school' });
  assert.equal(manhole.priority, 'Critical');
  assert.equal(manhole.publicImpactScore, 9);

  const garbage = fallbackAnalyze({ title: 'Dustbin full', description: 'Overflowing trash and rotten garbage dump' });
  assert.equal(garbage.category, 'Garbage & Sanitation');

  const cosmetic = fallbackAnalyze({ title: 'Signboard paint', description: 'Minor faded paint on park sign' });
  assert.equal(cosmetic.priority, 'Low');
});

test('clean sanitizes control characters and clamps string lengths', () => {
  assert.equal(clean('hello\u0000world\n', 20), 'hello world');
  assert.equal(clean('very long text', 4), 'very');
  assert.equal(clean(null, 10), '');
  assert.equal(clean(undefined, 10), '');
});
