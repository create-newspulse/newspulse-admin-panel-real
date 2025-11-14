// 📁 backend/models/PatchLog.js

const mongoose = require('mongoose');

const PatchLogSchema = new mongoose.Schema({
  patchName: {
    type: String,
    required: true,
    trim: true
  },
  applied: {
    type: Boolean,
    default: true,
  },
  appliedAt: {
    type: Date,
    default: Date.now,
  },
  // Optional: add for future trace/debug
  description: {
    type: String,
    default: '',
    trim: true
  },
  log: {
    type: String,
    default: '',
    trim: true
  }
}, {
  versionKey: false
});

// Safe export for dev/hot-reload
module.exports = mongoose.models.PatchLog || mongoose.model('PatchLog', PatchLogSchema);
