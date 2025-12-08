const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const filePath = path.join(__dirname, '../../../data/ai-trainer-state.json');

// Utility: Default empty log structure
const getDefaultState = () => ({
  lastTrained: null,
  logs: [],
  modulesTrained: [],
  state: 'Not Initialized'
});

// GET: /api/system/ai-training-log
router.get('/', (req, res) => {
  fs.readFile(filePath, 'utf8', (err, jsonData) => {
    if (err) {
      // If file not found, auto-create
      if (err.code === 'ENOENT') {
        const fallback = getDefaultState();
        fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2));
        return res.status(200).json({ success: true, data: fallback, message: 'File created, no logs yet.' });
      }
      console.error('❌ Failed to read ai-trainer-state.json:', err);
      return res.status(500).json({ success: false, error: 'Failed to read AI trainer data.' });
    }
    try {
      const parsed = JSON.parse(jsonData);
      return res.json({ success: true, data: parsed });
    } catch (parseErr) {
      console.error('❌ Failed to parse AI trainer JSON:', parseErr);
      // Optionally reset file
      const fallback = getDefaultState();
      fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2));
      return res.status(500).json({ success: false, error: 'AI trainer log was invalid/corrupt. Reset.' });
    }
  });
});

module.exports = router;
