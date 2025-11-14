const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  res.json({
    versions: [],
    status: 'ok',
    message: '✅ Version log loaded.'
  });
});

module.exports = router;
