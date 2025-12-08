// backend/models/AdminChatAudit.js
const mongoose = require('mongoose');

const AdminChatAuditSchema = new mongoose.Schema({
  message: String,
  user: String,
  action: String,
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AdminChatAudit', AdminChatAuditSchema);
