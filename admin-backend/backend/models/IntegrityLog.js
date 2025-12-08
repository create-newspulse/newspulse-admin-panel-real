const mongoose = require('mongoose');

const IntegrityLogSchema = new mongoose.Schema({
  file: {
    type: String,
    required: true,
    trim: true,
  },
  line: {
    type: Number,
    required: true,
  },
  snippet: {
    type: String,
    required: true,
    trim: true,
  },
  detectedAt: {
    type: Date,
    default: Date.now,
  }
}, {
  versionKey: false,
  timestamps: true // Adds createdAt & updatedAt automatically (optional, can remove)
});

// Safe export for dev/hot-reload
module.exports = mongoose.models.IntegrityLog || mongoose.model('IntegrityLog', IntegrityLogSchema);
