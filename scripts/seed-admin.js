'use strict';
/**
 * @file scripts/seed-admin.js
 * Seed the initial administrative account from environment variables.
 * Usage: npm run seed:admin
 */

if (process.env.NODE_ENV !== 'production') {
  try { require('dotenv').config(); } catch { /* ignore */ }
}

const { init: initFirebase, getAuth, IS_EMULATOR } = require('../config/firebase-admin');
const store = require('../services/store');

async function seedAdmin() {
  initFirebase();

  const email    = process.env.ADMIN_EMAIL    || 'admin@civicresolve.gov.in';
  const password = process.env.ADMIN_PASSWORD || 'CivicResolveAdmin2026!';
  const name     = process.env.ADMIN_NAME     || 'Chief Municipal Officer';

  console.log(`[seed-admin] Seeding admin user: ${email}`);

  let uid;
  try {
    const auth = getAuth();
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
      uid = userRecord.uid;
      console.log(`[seed-admin] Existing Auth user found with UID: ${uid}`);
    } catch (notFound) {
      userRecord = await auth.createUser({
        email,
        password,
        displayName: name,
        emailVerified: true
      });
      uid = userRecord.uid;
      console.log(`[seed-admin] Created new Firebase Auth user with UID: ${uid}`);
    }

    // Set custom claims: role=admin
    await auth.setCustomUserClaims(uid, { role: 'admin', department: 'Municipal Administration' });
    console.log(`[seed-admin] Custom claims set: role=admin`);
  } catch (authErr) {
    console.warn(`[seed-admin] Firebase Auth not available, using store record:`, authErr.message);
    uid = 'admin-' + Buffer.from(email).toString('hex').slice(0, 12);
  }

  // Create or update user doc in Firestore / store
  await store.upsertUser(uid, {
    uid,
    email,
    name,
    role: 'admin',
    department: 'Municipal Administration',
    status: 'active',
    updatedAt: new Date().toISOString()
  });

  console.log(`[seed-admin] Admin record saved to database successfully.`);
  process.exit(0);
}

seedAdmin().catch(err => {
  console.error('[seed-admin] Failed:', err);
  process.exit(1);
});
