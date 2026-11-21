'use strict';
/**
 * @file test/unit/validation.test.js
 * Unit tests for Zod schemas (report submission, overrides, queries).
 */

const test = require('node:test');
const assert = require('node:assert');
const {
  submitReportSchema,
  confirmImagesSchema,
  updateReportSchema,
  aiOverrideSchema,
  nlSearchSchema
} = require('../../middleware/validation');

test('submitReportSchema accepts valid report payload', () => {
  const valid = {
    title: 'Water pipe leaking on 5th cross',
    description: 'Clean drinking water pipe burst on 5th cross road since this morning.',
    location: '5th Cross, Indiranagar',
    category: 'Water & Drainage',
    lat: 12.9716,
    lng: 77.5946,
    language: 'en'
  };

  const parsed = submitReportSchema.parse(valid);
  assert.equal(parsed.title, valid.title);
  assert.equal(parsed.lat, 12.9716);
});

test('submitReportSchema rejects invalid fields', () => {
  // Title too short
  assert.throws(() => {
    submitReportSchema.parse({
      title: 'ab',
      description: 'Long enough description text here',
      location: 'Valid Location'
    });
  });

  // Description too short
  assert.throws(() => {
    submitReportSchema.parse({
      title: 'Valid Title Here',
      description: 'short',
      location: 'Valid Location'
    });
  });

  // Invalid coordinates
  assert.throws(() => {
    submitReportSchema.parse({
      title: 'Valid Title Here',
      description: 'Valid description text here for test',
      location: 'Valid Location',
      lat: 120.0 // out of -90..90
    });
  });
});

test('confirmImagesSchema enforces 1 to 5 image paths', () => {
  assert.ok(confirmImagesSchema.parse({ imagePaths: ['reports/CR-1/p1.jpg'] }));
  assert.ok(confirmImagesSchema.parse({ imagePaths: ['1', '2', '3', '4', '5'] }));

  // Empty array rejects
  assert.throws(() => confirmImagesSchema.parse({ imagePaths: [] }));

  // > 5 images rejects
  assert.throws(() => confirmImagesSchema.parse({ imagePaths: ['1', '2', '3', '4', '5', '6'] }));
});

test('aiOverrideSchema requires reason and at least category or priority', () => {
  assert.ok(aiOverrideSchema.parse({
    priority: 'Critical',
    reason: 'Emergency hazard observed by field supervisor'
  }));

  assert.ok(aiOverrideSchema.parse({
    category: 'Roads & Potholes',
    reason: 'Incorrect initial classification by reporter'
  }));

  // Missing reason rejects
  assert.throws(() => aiOverrideSchema.parse({ priority: 'Critical' }));

  // Reason too short (< 10 chars)
  assert.throws(() => aiOverrideSchema.parse({ priority: 'Critical', reason: 'short' }));

  // Neither category nor priority rejects
  assert.throws(() => aiOverrideSchema.parse({ reason: 'Valid length reason here without target' }));
});

test('nlSearchSchema validates query length', () => {
  assert.ok(nlSearchSchema.parse({ query: 'open drains in ward 12' }));
  assert.throws(() => nlSearchSchema.parse({ query: 'a' }));
});
