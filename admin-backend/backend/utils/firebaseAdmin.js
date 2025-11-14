// ✅ Centralized Firebase Admin initialization (safe for server-side only)
// - Reads credentials from FIREBASE_CREDENTIAL_PATH env (JSON file path)
// - Never requires a JSON inline in code to avoid accidental leaks

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

function initFirebaseAdmin() {
  if (admin.apps.length) return; // already initialized

  const rawPath = process.env.FIREBASE_CREDENTIAL_PATH || '';
  // Respect absolute paths (e.g., /etc/secrets/firebase.json on Render)
  // For relative paths, resolve from current working directory only
  const credPath = rawPath
    ? (path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath))
    : '';

  try {
    if (!credPath) {
      console.warn('⚠️ Skipping Firebase init: FIREBASE_CREDENTIAL_PATH not set');
      return;
    }
    if (!fs.existsSync(credPath)) {
      console.warn('⚠️ Skipping Firebase init: credential file not found at', credPath);
      return;
    }
    const json = JSON.parse(fs.readFileSync(credPath, 'utf-8'));
    admin.initializeApp({
      credential: admin.credential.cert(json),
      storageBucket: process.env.FIREBASE_BUCKET || undefined,
    });
    console.log('✅ Firebase Admin initialized');
  } catch (err) {
    console.warn('⚠️ Firebase Admin init failed:', err?.message || err);
  }
}

initFirebaseAdmin();
module.exports = admin;
