// 📁 backend/models/BugLog.js
const mongoose = require('mongoose');

// 🧠 Bug Log Schema
const BugLogSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'low',
    index: true
  },
  aiSummary: {
    type: String,
    trim: true,
    default: ''
  },
  autoFixed: {
    type: Boolean,
    default: false
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true // ✅ Adds createdAt & updatedAt automatically
});

// ✅ Safe export for hot-reload/dev
module.exports = mongoose.models.BugLog || mongoose.model('BugLog', BugLogSchema);
