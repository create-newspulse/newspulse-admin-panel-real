const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const VAULT_DIR = path.join(__dirname, '../../../uploads/vault');

router.get('/list', (req, res) => {
  try {
    const files = fs.readdirSync(VAULT_DIR).map(name => ({
      name,
      downloadUrl: `/uploads/vault/${name}`
    }));
    res.json({ files });
  } catch (err) {
    console.error('Vault list error:', err);
    res.status(500).json({ error: 'Failed to list vault files' });
  }
});

module.exports = router;
