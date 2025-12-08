const express = require('express');
const router = express.Router();
const exportReport = require('../../controllers/exportReport');

router.get('/export', exportReport);

module.exports = router;
