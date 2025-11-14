// ✅ File: backend/models/AIUsageLog.js

const mongoose = require('mongoose');

const AIUsageLogSchema = new mongoose.Schema({
  tool: {
    type: String,
    required: true, // Example: 'TrustMeter', 'SummaryBot'
  },
  usedAt: {
    type: Date,
    default: Date.now,
  },
  triggeredBy: {
    type: String, // e.g. 'system', 'admin', 'auto'
    default: 'system',
  },
  details: {
    type: Object, // Anything extra: { docId, params, ... }
    default: {},
  },
  result: {
    type: String, // e.g. 'success', 'error', optional error message
    default: '',
  },
  durationMs: {
    type: Number,
    default: null,
  },
}, {
  versionKey: false,
});

// Safe export (handles hot-reload)
module.exports = mongoose.models.AIUsageLog || mongoose.model('AIUsageLog', AIUsageLogSchema);
