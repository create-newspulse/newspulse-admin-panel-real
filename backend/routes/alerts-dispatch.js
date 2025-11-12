const express = require('express');
const router = express.Router();
const { runEscalation } = require('../utils/runner');

router.post('/dispatch', async (req, res) => {
  const { event, level, title, text, data } = req.body || {};
  const ok = await runEscalation(event, level, { title, text, data });
  return res.json({ ok });
});

module.exports = router;
