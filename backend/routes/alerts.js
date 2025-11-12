const express = require('express');
const router = express.Router();
const Escalation = require('../models/Escalation');

router.get('/settings', async (_req, res) => {
  let row = await Escalation.findOne().lean();
  if (!row) {
    row = await Escalation.create({
      levels: [
        { level: 'L1', name: 'Notice', description: 'Dashboard only', triggers: ['ops.traffic.spike', 'ai.guardrail.tripped'], autoLockdown: false, channels: { dashboard: true, email: false, sms: false, webhook: false } },
        { level: 'L2', name: 'Warning', description: 'Dashboard + Email', triggers: ['security.suspicious.login', 'ops.api.health_changed'], autoLockdown: false, channels: { dashboard: true, email: true, sms: false, webhook: false } },
        { level: 'L3', name: 'Critical', description: 'Full escalation + optional lockdown', triggers: ['security.breach'], autoLockdown: false, channels: { dashboard: true, email: true, sms: true, webhook: true } },
      ]
    });
  }
  return res.json({ ok: true, data: row });
});

router.post('/settings', async (req, res) => {
  const body = req.body || {};
  const updated = await Escalation.findOneAndUpdate({}, { ...body, updatedAt: new Date() }, { upsert: true, new: true, lean: true });
  return res.json({ ok: true, data: updated });
});

module.exports = router;
