'use strict';
/**
 * @file scripts/seed-admin.js
 * Seed the initial administrative account into Firebase Authentication and Cloud Firestore.
 * Usage: npm run seed:admin
 */

if (process.env.NODE_ENV !== 'production') {
  try { require('dotenv').config(); } catch { /* ignore */ }
}

const { init: initFirebase, getAuth, isMemoryMode, getDiagnostics } = require('../config/firebase-admin');
const store = require('../services/store');

async function seedAdmin() {
  initFirebase();

  const diag = getDiagnostics();
  console.log(`[seed-admin] Mode: ${diag.mode} | Database: ${diag.isMemoryMode ? 'In-Memory (Test/Mock)' : 'Cloud Firestore (Persistent)'}`);

  const email    = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name     = process.env.ADMIN_NAME     || 'Chief Municipal Officer';

  if (!email || !password) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD before seeding.');

  console.log(`[seed-admin] Seeding administrator: ${email}`);

  let uid;
  const auth = getAuth();

  // If in pure test memory mode without credentials, allow simulated creation for CI/offline tests
  if (isMemoryMode() && !process.env.FIREBASE_CLIENT_EMAIL) {
    uid = 'admin-' + Buffer.from(email).toString('hex').slice(0, 12);
    console.log(`[seed-admin] (Test Memory Mode) Generated admin UID: ${uid}`);
  } else {
    // Real Firebase mode or emulator: MUST succeed with Auth
    try {
      let userRecord;
      try {
        userRecord = await auth.getUserByEmail(email);
        uid = userRecord.uid;
        console.log(`[seed-admin] Found existing Firebase Auth user: ${uid}`);
        await auth.updateUser(uid, {
          displayName: name,
          password: password
        });
        console.log(`[seed-admin] Updated display name and password in Firebase Auth.`);
      } catch (notFoundErr) {
        if (notFoundErr.code === 'auth/user-not-found') {
          userRecord = await auth.createUser({
            email,
            password,
            displayName: name,
            emailVerified: true
          });
          uid = userRecord.uid;
          console.log(`[seed-admin] Created new Firebase Auth user with UID: ${uid}`);
        } else {
          throw notFoundErr;
        }
      }

      // Assign custom claims: role='admin'
      await auth.setCustomUserClaims(uid, {
        role: 'admin',
        department: 'Municipal Administration'
      });
      console.log(`[seed-admin] Successfully assigned admin custom claims: role=admin`);

    } catch (authError) {
      console.error(`[seed-admin] ERROR: Failed to configure administrator in Firebase Authentication:`, authError.message);
      // DO NOT report success or silently swallow. Fail clearly.
      process.exit(1);
    }
  }

  // Store administrator profile in Firestore
  try {
    const adminProfile = {
      uid,
      email,
      name,
      role: 'admin',
      department: 'Municipal Administration',
      status: 'active',
      updatedAt: new Date().toISOString()
    };
    await store.upsertUser(uid, adminProfile);
    console.log(`[seed-admin] Administrator profile successfully persisted in database (UID: ${uid}).`);
  } catch (dbError) {
    console.error(`[seed-admin] ERROR: Failed to persist admin profile in database:`, dbError.message);
    process.exit(1);
  }

  console.log(`[seed-admin] Admin seed completed successfully.`);
  process.exit(0);
}

seedAdmin().catch(err => {
  console.error('[seed-admin] Unexpected failure:', err);
  process.exit(1);
});

