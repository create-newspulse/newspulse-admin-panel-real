const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

router.delete('/delete/:filename', (req, res) => {
  const filePath = path.join(__dirname, '../../../uploads/vault', req.params.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: 'File not found' });
  }

  try {
    fs.unlinkSync(filePath);
    return res.json({ success: true, message: 'File deleted' });
  } catch (err) {
    console.error('Delete error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete file' });
  }
});

module.exports = router;
