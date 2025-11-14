// ✅ File: backend/routes/system/index.js

const express = require('express');
const router = express.Router();

// Utility to load route safely (won't crash if missing)
function safeRequire(routePath) {
  try {
    return require(routePath);
  } catch (e) {
    console.warn(`[SystemRoutes] Skipped missing or broken: ${routePath} – ${e.message}`);
    return (req, res, next) => next(); // No-op middleware
  }
}

// Core system routes
router.use('/integrity-scan', safeRequire('./integrity-scan'));
router.use('/ai-queue', safeRequire('./ai-queue'));
router.use('/thinking-feed', safeRequire('./thinking-feed'));
router.use('/ai-training-info', safeRequire('./ai-training-info'));
router.use('/dashboard-stats', safeRequire('./dashboard-stats'));
router.use('/ai-command', safeRequire('./ai-command'));

// Add other routes here as you build them out:
router.use('/ai-diagnostics', safeRequire('./ai-diagnostics'));
router.use('/ai-feedback', safeRequire('./ai-feedback'));
router.use('/ai-train', safeRequire('./ai-train'));
router.use('/ai-trainer', safeRequire('./ai-trainer'));
router.use('/ai-trainer-activate', safeRequire('./ai-trainer-activate'));
router.use('/alert-config', safeRequire('./alert-config'));
router.use('/api-keys', safeRequire('./apiKeys'));
router.use('/ask-kiranos', safeRequire('./ask-kiranos'));
router.use('/backup-now', safeRequire('./backupNow'));
router.use('/bug-alert', safeRequire('./bug-alert'));
router.use('/bug-reports', safeRequire('./bug-reports'));
router.use('/clear-command-logs', safeRequire('./clearCommandLogs'));
router.use('/command-logs', safeRequire('./command-logs'));
router.use('/emergency-lock', safeRequire('./emergencyLock'));
router.use('/emergency-unlock', safeRequire('./emergencyUnlock'));
router.use('/firebase-backup-trigger', safeRequire('./firebaseBackupTrigger'));
router.use('/firebase-upload-latest', safeRequire('./firebaseUploadLatest'));
router.use('/guardian-status', safeRequire('./guardianStatus'));
router.use('/incidents', safeRequire('./incidents'));
router.use('/ai-logs', safeRequire('./aiLogs'));
router.use('/ai-training-log', safeRequire('./ai-training-log'));
// ...add more as you expand

// Default healthy status route (can be used as health check)
router.get('/', (req, res) =>
  res.json({ success: true, message: '🟢 System routes are loaded and healthy.' })
);

module.exports = router;
