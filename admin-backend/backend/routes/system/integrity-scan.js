const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

/**
 * 🔍 System File Integrity Scanner
 * Scans key config files for suspicious code patterns.
 */
router.get('/', async (req, res) => {
  try {
    const rootDir = path.resolve(__dirname, '../../../..');
    const filesToScan = ['package.json', 'next.config.js', 'tsconfig.json'];
    const suspiciousPatterns = ['eval(', 'Function(', 'child_process', 'rm -rf', 'curl ', 'wget '];

    const issues = [];

    for (const file of filesToScan) {
      const filePath = path.join(rootDir, file);
      if (!fs.existsSync(filePath)) continue;

      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        if (suspiciousPatterns.some(pattern => line.includes(pattern))) {
          issues.push({
            file,
            line: index + 1,
            snippet: line.trim(),
          });
        }
      });
    }

    res.status(200).json({
      status: issues.length > 0 ? 'issues_found' : 'clean',
      scannedFiles: filesToScan.length,
      flaggedIssues: issues,
      scanCompletedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('🛡️ Integrity scan failed:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * 🤖 AI Integrity Monitoring Endpoint
 */
router.get('/ai-integrity', async (req, res) => {
  try {
    res.status(200).json({
      flaggedCommands: 3,
      autoDeletions: 2,
      pendingReviews: 1,
      lastTrainingDate: '2025-06-20T10:30:00.000Z',
      aiScoreImpact: '+1.3 Trust Score'
    });
  } catch (err) {
    console.error('❌ AI Integrity route failed:', err);
    res.status(500).json({ error: 'Failed to fetch AI integrity status.' });
  }
});

/**
 * 📜 Get AI Logs
 */
router.get('/logs', async (req, res) => {
  try {
    const logPath = path.join(__dirname, '../../../logs/ai.log');
    if (!fs.existsSync(logPath)) return res.status(404).json({ success: false, message: 'Log file not found' });

    const content = fs.readFileSync(logPath, 'utf8');
    res.json({ success: true, data: content });
  } catch (err) {
    console.error('❌ Failed to fetch logs:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch logs' });
  }
});

/**
 * 🧹 Clear AI Logs
 */
router.delete('/logs/clear', async (req, res) => {
  try {
    const logPath = path.join(__dirname, '../../../logs/ai.log');
    fs.writeFileSync(logPath, '');
    res.json({ success: true, message: 'Logs cleared successfully' });
  } catch (err) {
    console.error('❌ Failed to clear logs:', err);
    res.status(500).json({ success: false, message: 'Failed to clear logs' });
  }
});

module.exports = router;
