// ✅ File: backend/routes/system/backupNow.js
const express = require('express');
const router = express.Router();
const path = require('path');
const { exec } = require('child_process');

// POST /api/system/backup-now
router.post('/backup-now', async (req, res) => {
  // Use absolute path to script for safety
  const backupScript = path.join(__dirname, '../../utils/manualBackup.js');
  const command = `node "${backupScript}"`;

  try {
    exec(command, (err, stdout, stderr) => {
      if (err) {
        console.error('❌ Backup exec failed:', err);
        return res.status(500).json({
          success: false,
          error: 'Backup process failed.',
          details: process.env.NODE_ENV !== 'production' ? err.message : undefined,
        });
      }
      if (stderr) {
        console.warn('⚠️ Backup stderr:', stderr);
      }
      console.log('📦 Backup Output:', stdout);
      return res.json({
        success: true,
        message: '✅ Backup completed successfully.',
        output: process.env.NODE_ENV !== 'production' ? stdout : undefined,
      });
    });
  } catch (fatal) {
    console.error('❌ Backup Fatal Error:', fatal);
    return res.status(500).json({
      success: false,
      error: 'Backup route fatal error.',
      details: process.env.NODE_ENV !== 'production' ? fatal.message : undefined,
    });
  }
});

module.exports = router;
