// ✅ File: backend/routes/system/integrity-router.js

const express = require('express');
const router = express.Router();

// Defensive import: If integrity-scan exports a router, use it, otherwise wrap as needed
let integrityScan;
try {
  integrityScan = require('./integrity-scan');
} catch (e) {
  console.warn('[integrity-router] Failed to load integrity-scan:', e.message);
  // Fallback no-op handler
  integrityScan = (req, res) => res.status(503).json({ success: false, error: 'Integrity Scan service unavailable' });
}

// Accepts both router and plain handler
if (typeof integrityScan === 'function' && !integrityScan.stack) {
  router.get('/integrity-scan', integrityScan);
} else if (integrityScan.stack) {
  // If it's a sub-router, mount as-is
  router.use('/integrity-scan', integrityScan);
} else {
  // Unknown export
  router.get('/integrity-scan', (req, res) => 
    res.status(500).json({ success: false, error: 'Unknown integrity handler type' })
  );
}

module.exports = router;
