'use strict';
/**
 * @file config/firebase-admin.js
 * Firebase Admin SDK initialization supporting:
 *  1. Local real-Firebase development (via FIREBASE_CLIENT_EMAIL & FIREBASE_PRIVATE_KEY)
 *  2. Cloud Run production (via Application Default Credentials - ADC)
 *  3. Local emulator development (only when explicitly set: FIREBASE_EMULATOR=true)
 *  4. Test / Mock in-memory mode (only when NODE_ENV=test or STORE_MODE=memory)
 */

const admin = require('firebase-admin');

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID ||
                   process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
                   'civicresolve-dev';

const BUCKET_NAME = process.env.FIREBASE_STORAGE_BUCKET ||
                    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
                    process.env.GCS_BUCKET ||
                    `${PROJECT_ID}.appspot.com`;

const IS_EMULATOR = process.env.FIREBASE_EMULATOR === 'true';
const IS_TEST_OR_MOCK = process.env.NODE_ENV === 'test' || process.env.STORE_MODE === 'memory';

/**
 * Returns true if the storage layer should use in-memory collections.
 * Only active in automated tests or when running emulator without FIRESTORE_EMULATOR_HOST.
 * @returns {boolean}
 */
function isMemoryMode() {
  if (IS_TEST_OR_MOCK) return true;
  if (IS_EMULATOR && !process.env.FIRESTORE_EMULATOR_HOST) return true;
  return false;
}

let _db = null;
let _auth = null;
let _bucket = null;
let _initialized = false;

/**
 * Determine operational mode:
 * 'emulator' | 'test-memory' | 'real-credentials' | 'real-adc'
 * @returns {string}
 */
function getMode() {
  if (IS_TEST_OR_MOCK) return 'test-memory';
  if (IS_EMULATOR) return 'emulator';
  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) return 'real-credentials';
  return 'real-adc';
}

/**
 * Initialize Firebase Admin SDK.
 */
function init() {
  if (_initialized) return;
  _initialized = true;

  const mode = getMode();

  if (mode === 'emulator') {
    if (process.env.FIRESTORE_EMULATOR_HOST) {
      process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || 'localhost:9099';
      process.env.FIREBASE_STORAGE_EMULATOR_HOST = process.env.FIREBASE_STORAGE_EMULATOR_HOST || 'localhost:9199';
    }
    if (!admin.apps.length) {
      admin.initializeApp({ projectId: PROJECT_ID, storageBucket: BUCKET_NAME });
    }
    _auth = admin.auth();
    _db = admin.firestore();
    _bucket = admin.storage().bucket();

    if (process.env.FIRESTORE_EMULATOR_HOST) {
      _db.settings({ host: process.env.FIRESTORE_EMULATOR_HOST, ssl: false });
    }
    console.log(`[firebase] Mode: emulator | Project: ${PROJECT_ID} | Host: ${process.env.FIRESTORE_EMULATOR_HOST || 'internal'}`);
  } else if (mode === 'test-memory') {
    if (!admin.apps.length) {
      admin.initializeApp({ projectId: PROJECT_ID, storageBucket: BUCKET_NAME });
    }
    _auth = admin.auth();
    _db = admin.firestore();
    _bucket = admin.storage().bucket();
    if (process.env.DEBUG) {
      console.log(`[firebase] Mode: test-memory | Project: ${PROJECT_ID}`);
    }
  } else if (mode === 'real-credentials') {
    const rawKey = process.env.FIREBASE_PRIVATE_KEY || '';
    const privateKey = rawKey.includes('\\n') ? rawKey.replace(/\\n/g, '\n') : rawKey;
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey
        }),
        storageBucket: BUCKET_NAME
      });
    }
    _auth = admin.auth();
    _db = admin.firestore();
    _bucket = admin.storage().bucket();
    console.log(`[firebase] Mode: real-credentials | Project: ${PROJECT_ID} | ServiceAccount: ${process.env.FIREBASE_CLIENT_EMAIL} | Storage: ${BUCKET_NAME}`);
  } else {
    // real-adc (Cloud Run / GCP production using Application Default Credentials)
    if (!admin.apps.length) {
      admin.initializeApp({
        projectId: PROJECT_ID,
        storageBucket: BUCKET_NAME
      });
    }
    _auth = admin.auth();
    _db = admin.firestore();
    _bucket = admin.storage().bucket();
    console.log(`[firebase] Mode: real-adc (Application Default Credentials) | Project: ${PROJECT_ID} | Storage: ${BUCKET_NAME}`);
  }
}

/** @returns {import('firebase-admin').firestore.Firestore} */
function getDb() {
  if (!_initialized) init();
  return _db;
}

/** @returns {import('firebase-admin').auth.Auth} */
function getAuth() {
  if (!_initialized) init();
  return _auth;
}

/** @returns {import('@google-cloud/storage').Bucket} */
function getBucket() {
  if (!_initialized) init();
  return _bucket;
}

/**
 * Diagnostics information (never leaks private keys).
 * @returns {Object}
 */
function getDiagnostics() {
  return {
    mode: getMode(),
    initialized: _initialized,
    projectId: PROJECT_ID,
    storageBucket: BUCKET_NAME,
    hasClientEmail: Boolean(process.env.FIREBASE_CLIENT_EMAIL),
    hasPrivateKey: Boolean(process.env.FIREBASE_PRIVATE_KEY),
    isEmulator: IS_EMULATOR,
    isMemoryMode: isMemoryMode()
  };
}

module.exports = {
  init,
  getDb,
  getAuth,
  getBucket,
  IS_EMULATOR,
  IS_TEST_OR_MOCK,
  isMemoryMode,
  getMode,
  getDiagnostics,
  PROJECT_ID,
  BUCKET_NAME
};
