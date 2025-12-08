// 📁 backend/routes/system/ai-diagnostics.js

const express = require('express');
const router = express.Router();

// ====== Safely Import Utilities ======
let summarizeDiagnostics = async () => ({});
let logCommand = async () => {};

try {
  const diagUtils = require('../../utils/commandDiagnostics');
  if (typeof diagUtils?.summarizeDiagnostics === 'function') {
    summarizeDiagnostics = diagUtils.summarizeDiagnostics;
  } else {
    console.warn('⚠️ summarizeDiagnostics is not a function');
  }
} catch (err) {
  console.error('❌ summarizeDiagnostics util not loaded:', err?.stack || err.message);
}

try {
  const logUtils = require('../../utils/logCommand');
  if (typeof logUtils?.logCommand === 'function') {
    logCommand = logUtils.logCommand;
  } else {
    console.warn('⚠️ logCommand is not a function');
  }
} catch (err) {
  console.error('❌ logCommand util not loaded:', err?.stack || err.message);
}

// ====== 🧠 GET /api/system/ai-diagnostics ======
router.get('/', async (_req, res) => {
  try {
    const summary = await summarizeDiagnostics();
    if (!summary || typeof summary !== 'object') {
      throw new Error('summarizeDiagnostics returned invalid data');
    }

    const enhancedSummary = {
      success: true,
      status: '🟢 Healthy',
      uptime: `${Math.floor(process.uptime())} seconds`,
      aiModules: [
        'Headline Optimizer',
        'SEO Engine',
        'Anchor AI',
        'Trend Detector',
        'Behavior Scanner',
      ],
      timeSeries: summary?.timeSeries || [],
      patternHits: summary?.patternHits || {},
      mostUsed: summary?.mostUsed || ['None', 0],
      commandCount: summary?.commandCount || 0,
      lockedByFounder: summary?.lockedByFounder ?? true,
    };

    return res.status(200).json(enhancedSummary);
  } catch (err) {
    console.error('❌ [GET] AI Diagnostics error:', err?.stack || err.message);
    return res.status(500).json({
      success: false,
      status: '🔴 Error',
      message: 'Failed to summarize AI diagnostics.',
      error: err?.message || 'Unknown error',
    });
  }
});

// ====== 📥 POST /api/system/ai-diagnostics/ai-trainer/log ======
router.post('/ai-trainer/log', async (req, res) => {
  const { command, result, pattern } = req.body;

  if (!command || !result) {
    return res.status(400).json({
      success: false,
      message: '❌ Both "command" and "result" fields are required.',
    });
  }

  try {
    await logCommand({ command, result, pattern });
    return res.status(200).json({
      success: true,
      message: '✅ AI Trainer log saved.',
    });
  } catch (err) {
    console.error('❌ [POST] Log AI Trainer command failed:', err?.stack || err.message);
    return res.status(500).json({
      success: false,
      message: '❌ Failed to save command log.',
      error: err?.message || 'Internal error',
    });
  }
});

module.exports = router;
