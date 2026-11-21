'use strict';
/**
 * @file config/firebase-admin.js
 * Firebase Admin SDK initialization.
 * In dev/emulator mode: points all services to local emulators.
 * In prod: uses GOOGLE_APPLICATION_CREDENTIALS or ADC.
 */

const admin = require('firebase-admin');

const IS_EMULATOR = process.env.FIREBASE_EMULATOR === 'true' || process.env.NODE_ENV !== 'production';
const PROJECT_ID  = process.env.FIREBASE_PROJECT_ID || 'civicresolve-dev';
const BUCKET_NAME = process.env.GCS_BUCKET || `${PROJECT_ID}.appspot.com`;

let _db, _auth, _bucket, _initialized = false;

function init() {
  if (_initialized) return;
  _initialized = true;

  if (IS_EMULATOR) {
    // Point SDKs to emulators if env vars are set, otherwise fall through to in-memory store
    if (process.env.FIRESTORE_EMULATOR_HOST) {
      process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || 'localhost:9099';
      process.env.FIREBASE_STORAGE_EMULATOR_HOST = process.env.FIREBASE_STORAGE_EMULATOR_HOST || 'localhost:9199';
    }
    if (!admin.apps.length) {
      admin.initializeApp({ projectId: PROJECT_ID, storageBucket: BUCKET_NAME });
    }
  } else {
    if (!admin.apps.length) {
      // In production, use ADC or GOOGLE_APPLICATION_CREDENTIALS env var
      admin.initializeApp({ storageBucket: BUCKET_NAME });
    }
  }

  _auth   = admin.auth();
  _db     = admin.firestore();
  _bucket = admin.storage().bucket();

  if (IS_EMULATOR && process.env.FIRESTORE_EMULATOR_HOST) {
    _db.settings({ host: process.env.FIRESTORE_EMULATOR_HOST, ssl: false });
  }
}

/** @returns {import('firebase-admin').firestore.Firestore} */
function getDb()     { if (!_initialized) init(); return _db; }
/** @returns {import('firebase-admin').auth.Auth} */
function getAuth()   { if (!_initialized) init(); return _auth; }
/** @returns {import('@google-cloud/storage').Bucket} */
function getBucket() { if (!_initialized) init(); return _bucket; }

module.exports = { init, getDb, getAuth, getBucket, IS_EMULATOR, PROJECT_ID };
