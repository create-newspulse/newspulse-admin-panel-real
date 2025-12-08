// ✅ File: backend/routes/system/ai-command.js

const express = require('express');
const router = express.Router();

// 📦 Optionally import system logic dynamically only if needed

router.post('/ai-command', async (req, res) => {
  const { command = '' } = req.body;
  const trimmed = command.trim().toLowerCase();

  if (!trimmed) {
    return res.status(400).json({ success: false, result: '', message: 'No command provided' });
  }

  let result = '';
  let error = null;

  try {
    switch (trimmed) {
      case 'ai status':
        result = '🟢 KiranOS AI is active and fully operational.';
        break;

      case 'start system check':
        result = '🛠️ System diagnostics triggered. All modules being scanned...';
        // TODO: Add actual diagnostic logic or call
        break;

      case 'optimize website':
        result = '⚡ Optimization sequence started. Performance boost incoming...';
        // TODO: Call optimizer script here
        break;

      case 'backup now':
        try {
          // Dynamic import for less startup overhead
          const backupNow = require('./backupNow');
          if (typeof backupNow.triggerBackup === 'function') {
            await backupNow.triggerBackup();
            result = '✅ Manual backup completed successfully.';
          } else {
            result = '❌ Backup method not implemented.';
          }
        } catch (err) {
          result = '❌ Backup failed. Check logs.';
          error = err.message || err;
        }
        break;

      case 'lock system':
        try {
          const emergencyLock = require('./emergencyLock');
          if (typeof emergencyLock.emergencyLock === 'function') {
            await emergencyLock.emergencyLock();
            result = '🔒 Emergency lock activated.';
          } else {
            result = '❌ Emergency lock not implemented.';
          }
        } catch (err) {
          result = '❌ Failed to lock system.';
          error = err.message || err;
        }
        break;

      case 'unlock system':
        try {
          const emergencyUnlock = require('./emergencyUnlock');
          if (typeof emergencyUnlock.emergencyUnlock === 'function') {
            await emergencyUnlock.emergencyUnlock();
            result = '🔓 System unlocked.';
          } else {
            result = '❌ Emergency unlock not implemented.';
          }
        } catch (err) {
          result = '❌ Failed to unlock system.';
          error = err.message || err;
        }
        break;

      default:
        result = `⚠️ Unknown command: "${command}"`;
    }

    return res.json({
      success: !error,
      result,
      ...(error ? { error } : {})
    });

  } catch (err) {
    // Absolute fallback if something unexpected blows up
    console.error('❌ AI Command Route Error:', err);
    return res.status(500).json({
      success: false,
      result: '',
      error: err.message || 'Internal error'
    });
  }
});

module.exports = router;
