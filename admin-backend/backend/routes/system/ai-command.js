// admin-backend/routes/system/ai-command.js

const express = require('express');
const router = express.Router();
const { saveCommandLog } = require('../../utils/commandLogger');

// Ensure JSON body parsing for this router (if not at app level)
router.use(express.json());

// 🟢 Health check
router.get('/', (_req, res) => {
  res.json({ success: true, message: '🟢 AI Command endpoint is active.' });
});

// 🟢 AI Command trigger
router.post('/', async (req, res) => {
  const command = typeof req.body.command === 'string' ? req.body.command : '';
  const trigger = typeof req.body.trigger === 'string' ? req.body.trigger : 'manual';
  const trimmed = command.trim().toLowerCase();

  if (!trimmed) {
    return res.status(400).json({
      success: false,
      result: '❌ Command is required.',
      error: 'Empty command'
    });
  }

  let result = '';

  try {
    // Match recognized commands
    switch (true) {
      case trimmed.includes('ai status'):
        result = '🧠 KiranOS is online and fully operational.';
        break;
      case trimmed.includes('start system check'):
        result = '✅ Running full system diagnostics...';
        break;
      case trimmed.includes('optimize website'):
        result = '🚀 Optimization process has been triggered.';
        break;
      case trimmed.includes('backup system'):
        result = '📦 System backup is now in progress.';
        break;
      case trimmed.includes('traffic report'):
        result = '📊 Fetching latest traffic analytics...';
        break;
      case trimmed.includes('security scan'):
        result = '🛡️ Security scan (threat detection) initiated.';
        break;
      case trimmed.includes('update ai'):
        result = '🔁 AI is updating its models and memory.';
        break;
      case trimmed.includes('pause automation'):
        result = '⏸️ Automation is now paused.';
        break;
      case trimmed.includes('resume ai'):
        result = '▶️ AI automation resumed.';
        break;
      case trimmed.includes('shutdown ai'):
        result = '🔴 Emergency shutdown sequence started!';
        break;
      default:
        result = `⚠️ Unknown command: "${command}"`;
        break;
    }

    // Defensive logging
    try {
      await saveCommandLog({
        command: trimmed,
        trigger,
        result,
        usedBy: req.user?.username || 'admin'
      });
    } catch (logErr) {
      // Log but do not fail the API
      console.warn('⚠️ Failed to save AI command log:', logErr.message);
    }

    return res.json({ success: true, result });

  } catch (err) {
    console.error('❌ AI Command Error:', err);
    return res.status(500).json({
      success: false,
      result: '❌ Command failed. Try again later.',
      error: err.message || 'Unknown error'
    });
  }
});

module.exports = router;
