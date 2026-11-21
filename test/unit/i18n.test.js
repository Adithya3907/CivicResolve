'use strict';
/**
 * @file test/unit/i18n.test.js
 * Unit test for 23 Indian language locale completeness.
 * Verifies every locale has 100% of keys present in en.json.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { LANGUAGE_CODES } = require('../../config/constants');

const LOCALES_DIR = path.join(__dirname, '..', '..', 'public', 'locales');
const EN_PATH = path.join(LOCALES_DIR, 'en.json');

function flatten(obj, prefix = '') {
  let result = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flatten(value, fullKey));
    } else {
      result[fullKey] = value;
    }
  }
  return result;
}

test('en.json exists and has complete translation structure', () => {
  assert.ok(fs.existsSync(EN_PATH), 'en.json must exist');
  const en = JSON.parse(fs.readFileSync(EN_PATH, 'utf8'));
  const flat = flatten(en);
  assert.ok(Object.keys(flat).length >= 80, `Expected at least 80 keys in en.json, got ${Object.keys(flat).length}`);
});

test('all 23 language files exist and have no missing keys', () => {
  const en = JSON.parse(fs.readFileSync(EN_PATH, 'utf8'));
  const enFlat = flatten(en);
  const requiredKeys = Object.keys(enFlat);

  assert.equal(LANGUAGE_CODES.length, 23);

  for (const lang of LANGUAGE_CODES) {
    const filePath = path.join(LOCALES_DIR, `${lang}.json`);
    assert.ok(fs.existsSync(filePath), `Locale file ${lang}.json must exist`);

    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const flat = flatten(content);

    // Check all required keys exist
    for (const key of requiredKeys) {
      assert.ok(
        flat[key] !== undefined && flat[key] !== null,
        `Locale ${lang}.json is missing key: ${key}`
      );
    }
  }
});
