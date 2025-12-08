// ✅ File: backend/routes/system/firebaseUploadLatest.js
const express = require('express');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// TODO: Set this to your real bucket name via ENV!
const BUCKET_NAME = process.env.FIREBASE_BUCKET || 'your-firebase-bucket-name.appspot.com';
const FILE_PATH = path.join(__dirname, '../data/backup-latest.zip');

router.post('/firebase-upload-latest', async (req, res) => {
  try {
    // Defensive check: file existence
    if (!fs.existsSync(FILE_PATH)) {
      return res.status(404).json({
        success: false,
        message: 'Backup file not found.',
        file: FILE_PATH,
      });
    }

    // Defensive: Check Firebase is initialized
    if (!admin.apps.length) {
      return res.status(500).json({
        success: false,
        message: 'Firebase Admin SDK not initialized.',
      });
    }

    const bucket = admin.storage().bucket(BUCKET_NAME);

    // Upload to Firebase Storage
    await bucket.upload(FILE_PATH, {
      destination: 'backups/backup-latest.zip',
      metadata: { contentType: 'application/zip' },
    });

    console.log('✅ Backup uploaded to Firebase Storage');
    return res.json({
      success: true,
      message: 'Backup uploaded to Firebase Storage.',
      destination: `gs://${BUCKET_NAME}/backups/backup-latest.zip`
    });
  } catch (err) {
    console.error('❌ Firebase upload failed:', err.message || err);
    res.status(500).json({
      success: false,
      message: 'Firebase upload failed.',
      error: process.env.NODE_ENV !== 'production' ? err.message : undefined,
    });
  }
});

module.exports = router;
