const mongoose = require('mongoose');

const APIHealthLogSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      enum: [
        'news', 'weather', 'twitter', 'ai-training', 'sentinel', 'custom'
      ], // 🌐 Add more sources if you monitor extra APIs!
    },
    uptime: {
      type: Number,
      min: 0,
      max: 100,
      default: 100,
    },
    checkedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    status: {
      type: String,
      enum: ['healthy', 'unstable', 'down'],
      default: 'healthy',
      index: true,
    },
    errorDetails: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: true, // ✅ createdAt & updatedAt
    versionKey: false,
  }
);

// 📌 Optional: index for fast recent logs per API
APIHealthLogSchema.index({ name: 1, checkedAt: -1, status: 1 }, { unique: false });

module.exports = mongoose.models.APIHealthLog || mongoose.model('APIHealthLog', APIHealthLogSchema);
