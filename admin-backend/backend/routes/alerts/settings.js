const express = require('express');
const router = express.Router();

// In-memory escalation store (Mongo-backed version lives in main backend; this keeps UI functional in admin-backend mode)
let ESCALATION = {
  levels: [
    { level: 'L1', name: 'Notice', description: 'Dashboard only', triggers: ['ops.traffic.spike', 'ai.guardrail.tripped'], autoLockdown: false, channels: { dashboard: true, email: false, sms: false, webhook: false } },
    { level: 'L2', name: 'Warning', description: 'Dashboard + Email', triggers: ['security.suspicious.login', 'ops.api.health_changed'], autoLockdown: false, channels: { dashboard: true, email: true, sms: false, webhook: false } },
    { level: 'L3', name: 'Critical', description: 'Full escalation + optional lockdown', triggers: ['security.breach'], autoLockdown: false, channels: { dashboard: true, email: true, sms: true, webhook: true } },
  ],
  updatedAt: new Date().toISOString(),
};

router.get('/settings', (_req, res) => {
  res.json({ ok: true, data: ESCALATION });
});

router.post('/settings', (req, res) => {
  const body = req.body || {};
  ESCALATION = { ...ESCALATION, ...body, updatedAt: new Date().toISOString() };
  res.json({ ok: true, data: ESCALATION });
});

module.exports = router;
