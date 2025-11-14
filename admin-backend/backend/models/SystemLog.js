const mongoose = require('mongoose');

const SystemLogSchema = new mongoose.Schema({
  type: { type: String, required: true, trim: true },
  timestamp: { type: Date, default: Date.now },
  message: { type: String, trim: true },
  userId: { type: String, default: null }, // Or ObjectId if needed
  meta: { type: Object, default: {} },     // Extra info (optional)
}, { timestamps: true });

// Safe export (prevents overwrite in dev/hot reload)
module.exports = mongoose.models.SystemLog || mongoose.model('SystemLog', SystemLogSchema);
