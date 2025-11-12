const express = require('express');
const router = express.Router();
const { verifyPin, rotatePin } = require('../utils/pin');
const { audit } = require('../utils/audit');

router.post('/rotate', async (req, res) => {
  const { oldPin, newPin } = req.body || {};
  if (!oldPin || !newPin) return res.status(400).json({ ok: false, error: 'oldPin & newPin required' });
  if (String(newPin).length < 6) return res.status(400).json({ ok: false, error: 'PIN must be 6+ chars' });
  const ok = await verifyPin(oldPin);
  if (!ok) return res.status(401).json({ ok: false, error: 'Invalid old PIN' });
  await rotatePin(newPin);
  try { await audit('founder.pin.rotated', 'founder', 'FOUNDER', { masked: '****' }); } catch {}
  return res.json({ ok: true, at: new Date().toISOString() });
});

module.exports = router;
