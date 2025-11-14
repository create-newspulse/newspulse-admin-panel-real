const express = require('express');
const fs = require('fs');
const path = require('path');
const verifyToken = require('../middleware/verifyToken');
const verifyFounder = require('../middleware/verifyFounder');

const router = express.Router();
const pinFilePath = path.join(__dirname, '../storage/founder-pin.json');

// 🔐 Verify Founder PIN securely (used by SignatureUnlock)
router.post('/verify-pin', verifyToken, verifyFounder, (req, res) => {
  try {
    const { pin } = req.body;

    if (!pin) {
      return res.status(400).json({ success: false, message: 'PIN is required' });
    }

    const data = JSON.parse(fs.readFileSync(pinFilePath, 'utf8'));

    if (data.pin === pin) {
      console.log('✅ Founder PIN verified successfully');
      return res.status(200).json({ success: true });
    }

    return res.status(401).json({ success: false, message: 'Invalid PIN' });

  } catch (err) {
    console.error('❌ PIN verification error:', err.message);
    return res.status(500).json({ success: false, message: 'Verification failed' });
  }
});

// 🔁 Update Founder PIN (used by UpdateFounderPIN UI)
router.post('/update-pin', verifyToken, verifyFounder, (req, res) => {
  try {
    const { pin } = req.body;

    if (!pin || typeof pin !== 'string' || pin.length < 6) {
      return res.status(400).json({ success: false, message: 'Invalid PIN (min 6 characters)' });
    }

    fs.writeFileSync(pinFilePath, JSON.stringify({ pin }), 'utf8');
    console.log('🔒 Founder PIN updated successfully');

    return res.status(200).json({ success: true, message: 'PIN updated successfully' });

  } catch (err) {
    console.error('❌ Failed to update PIN:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to update PIN' });
  }
});

module.exports = router;
