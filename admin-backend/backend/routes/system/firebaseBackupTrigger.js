// ✅ File: backend/routes/system/firebaseBackupTrigger.js
const express = require('express');
const router = express.Router();
const { exec } = require('child_process');

/**
 * POST /api/system/firebase-backup
 * Triggers the Firebase backup utility script.
 */
router.post('/firebase-backup', async (req, res) => {
  try {
    // Absolute or relative path can be used, update as needed:
    const backupScript = 'node backend/utils/firebaseBackup.js';

    exec(backupScript, (err, stdout, stderr) => {
      if (err) {
        console.error('❌ Firebase Backup Error:', err.message);
        return res.status(500).json({
          success: false,
          message: 'Firebase backup process failed.',
          error: err.message
        });
      }
      if (stderr) {
        console.warn('⚠️ Firebase Backup Warning:', stderr);
      }
      console.log('✅ Firebase Backup Output:\n', stdout);

      // Always return JSON even if warnings occur
      return res.json({
        success: true,
        message: 'Firebase backup completed.',
        output: stdout,
        warning: stderr || undefined
      });
    });
  } catch (err) {
    console.error('❌ Unexpected Error during Firebase Backup:', err);
    res.status(500).json({
      success: false,
      message: 'Unexpected error during Firebase backup trigger.',
      error: process.env.NODE_ENV !== 'production' ? err.message : undefined
    });
  }
});

module.exports = router;
