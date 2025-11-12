const express = require('express');
const router = express.Router();
const AuditEvent = require('../models/AuditEvent');

router.get('/recent', async (_req, res) => {
  const items = await AuditEvent.find({}, { _id: 0 }).sort({ ts: -1 }).limit(100).lean();
  return res.json({ ok: true, items });
});

module.exports = router;
