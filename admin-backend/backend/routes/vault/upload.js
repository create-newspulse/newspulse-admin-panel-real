const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const uploadToDrive = require('../../utils/driveUpload'); // ✅ ADD THIS

const router = express.Router();

// Where to store the vault files locally
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const vaultDir = path.join(__dirname, '../../../uploads/vault');
    if (!fs.existsSync(vaultDir)) fs.mkdirSync(vaultDir, { recursive: true });
    cb(null, vaultDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const cleanName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
    cb(null, `${timestamp}__${cleanName}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.zip', '.vault'];
    if (allowed.includes(path.extname(file.originalname))) cb(null, true);
    else cb(new Error('❌ Invalid file type.'));
  }
});

// ✅ Route: POST /api/vault/upload
router.post('/upload', upload.single('vault'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

  try {
    // ✅ Auto-sync to Google Drive after successful upload
    const result = await uploadToDrive(
      req.file.path,
      req.file.filename,
      process.env.GDRIVE_VAULT_FOLDER
    );

    console.log('✅ Uploaded to Google Drive:', result.id);

    return res.json({
      success: true,
      file: req.file.filename,
      driveId: result.id,
    });
  } catch (err) {
    console.error('❌ Google Drive Sync Failed:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Upload saved locally but Google Drive sync failed.',
    });
  }
});

module.exports = router;
