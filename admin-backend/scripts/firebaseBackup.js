// ✅ File: scripts/firebaseBackup.js
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const admin = require('../backend/utils/firebase'); // Your Firebase init file
require('dotenv').config();

// 📦 Define models you want to backup
const MODELS = {
  News: require('../backend/models/News'),
  SystemSettings: require('../backend/models/SystemSettings'),
  Founder: require('../backend/models/Founder'),
  AIActivity: require('../backend/models/AIActivity'),
  Log: require('../backend/models/AdminLog'),
};

const backup = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('🔌 MongoDB connected');

    const backupData = {};

    for (const [key, model] of Object.entries(MODELS)) {
      backupData[key] = await model.find().lean();
    }

    const backupDir = path.join(__dirname, '../backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);

    const timestamp = new Date().toISOString().split('T')[0];
    const filePath = path.join(backupDir, `news-backup-${timestamp}.json`);
    fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2));

    // 🔐 Zip it
    const zipPath = `${filePath}.zip`;
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.pipe(output);
    archive.file(filePath, { name: 'backup.json' });
    await archive.finalize();

    // 📤 Upload to Firebase Storage
    const bucket = admin.storage().bucket();
    await bucket.upload(zipPath, {
      destination: `backups/${timestamp}/news-backup.json.zip`,
      gzip: true,
      metadata: {
        cacheControl: 'no-cache',
      },
    });

    console.log(`✅ Backup uploaded to Firebase → backups/${timestamp}/news-backup.json.zip`);

    fs.unlinkSync(filePath);
    fs.unlinkSync(zipPath);
    mongoose.disconnect();
  } catch (err) {
    console.error('❌ Backup Failed:', err);
    process.exit(1);
  }
};

backup();
