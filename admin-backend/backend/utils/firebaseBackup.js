// ✅ File: backend/utils/firebaseBackup.js
// Initialize centralized Firebase Admin (uses FIREBASE_CREDENTIAL_PATH)
const admin = require('./firebaseAdmin');
const fs = require('fs');
const path = require('path');

// Resolve target bucket (env or project default)
const bucket = admin.storage().bucket(process.env.FIREBASE_BUCKET);

// 📁 Define what to back up
const sourceDir = path.join(__dirname, '..', 'data'); // You can change this to /uploads or anything else

// 📤 Upload all files in sourceDir to Firebase Storage
const uploadBackup = async () => {
  const files = fs.readdirSync(sourceDir);
  for (const file of files) {
    const localPath = path.join(sourceDir, file);
    const remotePath = `backups/${file}`;
    await bucket.upload(localPath, {
      destination: remotePath,
      metadata: {
        contentType: 'application/json',
      },
    });
    console.log(`✅ Uploaded: ${file}`);
  }
};

uploadBackup().catch(err => {
  console.error('❌ Firebase Backup Failed:', err.message);
});
