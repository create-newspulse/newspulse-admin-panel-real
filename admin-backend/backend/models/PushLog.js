const mongoose = require('mongoose');

// 📦 Push Log Schema
const pushLogSchema = new mongoose.Schema(
  {
    topic: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150
    },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000
    },
    role: {
      type: String,
      default: 'all',
      enum: ['all', 'admin', 'mobile', 'web', 'custom']
    },
    firebaseId: {
      type: String,
      trim: true,
      default: '', // 🟢 Optional: add default for clarity
    }
  },
  {
    timestamps: true // ✅ createdAt & updatedAt
  }
);

// 📌 Index for quick retrieval by time
pushLogSchema.index({ createdAt: -1 });

module.exports = mongoose.models.PushLog || mongoose.model('PushLog', pushLogSchema);
