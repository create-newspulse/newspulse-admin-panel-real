// 📁 backend/models/ThreatLog.js
const mongoose = require('mongoose');

const threatLogSchema = new mongoose.Schema(
  {
    xssDetected: {
      type: Boolean,
      default: false,
    },
    credentialsLeaked: {
      type: Boolean,
      default: false,
    },
    ipReputationScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    proxyDetected: {
      type: Boolean,
      default: false,
    },
    virusReported: {
      type: Boolean,
      default: false,
    },
    lastScan: {
      type: Date,
      default: Date.now,
    },
    origin: {
      type: String,
      enum: ['manual', 'auto'],
      default: 'auto',
    }
  },
  {
    timestamps: true, // Adds createdAt & updatedAt
    versionKey: false // Hides __v, optional but keeps JSON clean
  }
);

// ✅ Safe export for hot-reload/dev/prod environments
module.exports = mongoose.models.ThreatLog || mongoose.model('ThreatLog', threatLogSchema);
