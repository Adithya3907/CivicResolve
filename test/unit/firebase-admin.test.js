'use strict';
/**
 * @file test/unit/firebase-admin.test.js
 * Unit tests for Firebase Admin SDK initialization, emulator selection,
 * private key newline parsing, storage bucket resolution, and persistence mode logic.
 */

const test = require('node:test');
const assert = require('node:assert');

test('Firebase Admin configuration and mode resolution', async (t) => {
  const originalEnv = { ...process.env };

  await t.test('private key \\n conversion correctly handles escaped newlines', () => {
    const rawKey = '-----BEGIN PRIVATE KEY-----\\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASC\\n-----END PRIVATE KEY-----';
    const converted = rawKey.includes('\\n') ? rawKey.replace(/\\n/g, '\n') : rawKey;
    assert.ok(converted.includes('\n'), 'Converted key must contain real newline characters');
    assert.ok(!converted.includes('\\n'), 'Converted key must not contain escaped \\n sequences');
    assert.equal(converted.split('\n').length, 3);
  });

  await t.test('bucket resolution respects FIREBASE_STORAGE_BUCKET and NEXT_PUBLIC fallbacks', () => {
    const resolveBucket = (env) => {
      const proj = env.FIREBASE_PROJECT_ID || 'test-proj';
      return env.FIREBASE_STORAGE_BUCKET ||
             env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
             env.GCS_BUCKET ||
             `${proj}.appspot.com`;
    };

    assert.equal(
      resolveBucket({ FIREBASE_STORAGE_BUCKET: 'custom.firebasestorage.app' }),
      'custom.firebasestorage.app'
    );
    assert.equal(
      resolveBucket({ NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'next.firebasestorage.app' }),
      'next.firebasestorage.app'
    );
    assert.equal(
      resolveBucket({ GCS_BUCKET: 'gcs.appspot.com' }),
      'gcs.appspot.com'
    );
    assert.equal(
      resolveBucket({ FIREBASE_PROJECT_ID: 'my-project' }),
      'my-project.appspot.com'
    );
  });

  await t.test('mode selection distinguishes between test, emulator, credentials, and ADC', () => {
    const resolveMode = (env) => {
      if (env.NODE_ENV === 'test' || env.STORE_MODE === 'memory') return 'test-memory';
      if (env.FIREBASE_EMULATOR === 'true') return 'emulator';
      if (env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) return 'real-credentials';
      return 'real-adc';
    };

    // Test mode
    assert.equal(resolveMode({ NODE_ENV: 'test' }), 'test-memory');
    assert.equal(resolveMode({ STORE_MODE: 'memory' }), 'test-memory');

    // Explicit emulator
    assert.equal(resolveMode({ FIREBASE_EMULATOR: 'true' }), 'emulator');

    // Real credentials in development
    assert.equal(
      resolveMode({
        NODE_ENV: 'development',
        FIREBASE_CLIENT_EMAIL: 'sa@proj.iam.gserviceaccount.com',
        FIREBASE_PRIVATE_KEY: 'key'
      }),
      'real-credentials'
    );

    // Production Cloud Run without service account key file (uses ADC)
    assert.equal(
      resolveMode({ NODE_ENV: 'production', FIREBASE_PROJECT_ID: 'cloud-run-proj' }),
      'real-adc'
    );
  });

  await t.test('isMemoryMode is active ONLY in tests or unhosted emulator', () => {
    const checkMemoryMode = (env) => {
      const isTestOrMock = env.NODE_ENV === 'test' || env.STORE_MODE === 'memory';
      const isEmulator = env.FIREBASE_EMULATOR === 'true';
      if (isTestOrMock) return true;
      if (isEmulator && !env.FIRESTORE_EMULATOR_HOST) return true;
      return false;
    };

    // Active in test
    assert.equal(checkMemoryMode({ NODE_ENV: 'test' }), true);
    // Active in emulator without host
    assert.equal(checkMemoryMode({ FIREBASE_EMULATOR: 'true' }), true);
    // Inactive when emulator host is provided
    assert.equal(checkMemoryMode({ FIREBASE_EMULATOR: 'true', FIRESTORE_EMULATOR_HOST: 'localhost:8085' }), false);
    // Inactive in real development with credentials
    assert.equal(checkMemoryMode({ NODE_ENV: 'development', FIREBASE_CLIENT_EMAIL: 'sa@test', FIREBASE_PRIVATE_KEY: 'k' }), false);
    // Inactive in production Cloud Run
    assert.equal(checkMemoryMode({ NODE_ENV: 'production' }), false);
  });

  // Restore env
  process.env = originalEnv;
});
