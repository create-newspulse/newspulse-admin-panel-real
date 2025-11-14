// ✅ File: backend/models/AdminChatLog.js

const mongoose = require('mongoose');

const AdminChatLogSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now,
  },
  type: {
    type: String,
    enum: ['AI', 'ADMIN', 'ERROR'],
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  origin: {
    type: String, // e.g., "KiranOS", "AdminPanel", "AutoSummaryBot"
    default: 'System',
  }
}, { collection: 'admin_chat_logs' }); // optional: collection name override

module.exports = mongoose.model('AdminChatLog', AdminChatLogSchema);
