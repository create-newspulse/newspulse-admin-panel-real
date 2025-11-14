// backend/routes/uploads.js
const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

const router = express.Router();

// Ensure uploads dir exists
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'covers');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Multer storage: unique filename
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeBase = path.basename(file.originalname, ext).replace(/[^\w\-]+/g, '');
    const fname = `${safeBase || 'image'}-${Date.now()}${ext}`;
    cb(null, fname);
  }
});

// Accept only images; 5MB max
function fileFilter(_req, file, cb) {
  const ok = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
  cb(ok ? null : new Error('Only JPG/PNG/WEBP allowed'), ok);
}
const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

// GET /api/uploads  – list uploaded cover files (stub)
router.get('/', (_req, res) => {
  try {
    const files = fs.readdirSync(UPLOAD_DIR).map((name) => ({
      id: name,
      name,
      url: `/uploads/covers/${name}`,
    }));
    res.json({ success: true, data: files });
  } catch (e) {
    res.json({ success: true, data: [] });
  }
});

// POST /api/uploads/cover  (auth: founder/admin/editor)
router.post(
  '/cover',
  auth,
  requireRole('founder', 'admin', 'editor'),
  upload.single('file'),
  (req, res) => {
    // static URL (served by express.static you’ll add below)
    const filename = req.file.filename;
    const url = `/uploads/covers/${filename}`;
    res.json({ success: true, url, filename });
  }
);

// (optional) DELETE by filename (auth: founder/admin)
router.delete(
  '/cover/:filename',
  auth,
  requireRole('founder', 'admin'),
  (req, res) => {
    const fp = path.join(UPLOAD_DIR, req.params.filename);
    fs.unlink(fp, (err) => {
      if (err) return res.status(404).json({ success: false, message: 'File not found' });
      res.json({ success: true, deleted: true });
    });
  }
);

module.exports = router;
