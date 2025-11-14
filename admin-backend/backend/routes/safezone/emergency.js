const express = require('express');
const router = express.Router();

router.post('/emergency-lockdown', (req, res) => {
  console.log('🔒 Emergency lockdown triggered');
  res.json({ success: true, message: 'System lockdown initialized.' });
});

router.post('/reactivate-system', (req, res) => {
  console.log('♻️ System reactivation triggered');
  res.json({ success: true, message: 'System reactivated successfully.' });
});

module.exports = router;
