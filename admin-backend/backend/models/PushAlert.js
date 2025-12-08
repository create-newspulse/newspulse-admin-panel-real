const mongoose = require('mongoose');

// 📦 Push Alert Schema
const pushAlertSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 150
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  target: {
    type: String,
    default: 'all', // 🧭 Could be: 'all', 'admin', 'mobile', 'web', 'custom'
    enum: ['all', 'admin', 'mobile', 'web', 'custom']
  },
  isDummy: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true // ✅ Auto-creates createdAt & updatedAt
});

// 📌 Index for fast sorting (latest first)
pushAlertSchema.index({ createdAt: -1 });

// ✅ Safe model export
module.exports = mongoose.models.PushAlert || mongoose.model('PushAlert', pushAlertSchema);
