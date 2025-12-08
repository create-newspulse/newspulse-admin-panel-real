const mongoose = require('mongoose');

const RelaxVideoSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  embedCode: {            // <-- For storing YouTube embed code, iframe, etc.
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['drone', 'nature', 'music', 'other'],
    default: 'drone',
  },
  source: {
    type: String,
    default: 'Manual',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, {
  versionKey: false,
});

// Safe export for dev/hot-reload
module.exports = mongoose.models.RelaxVideo || mongoose.model('RelaxVideo', RelaxVideoSchema);
