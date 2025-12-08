const mongoose = require('mongoose');

const incidentSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['Security', 'System', 'Database', 'Network', 'Other'],
    required: true,
    trim: true
  }, // e.g., 'Security', 'System'
  level: {
    type: String,
    enum: ['Critical', 'High', 'Moderate', 'Low'],
    required: true,
    trim: true
  }, // e.g., 'Critical', 'Moderate'
  actionTaken: {
    type: String,
    default: '',
    trim: true
  },
  status: {
    type: String,
    enum: ['Locked', 'Resolved', 'Pending', 'Investigating'],
    default: 'Pending',
    trim: true
  }, // e.g., 'Locked', 'Resolved'
  description: {
    type: String,
    default: '',
    trim: true
  },
  metadata: {
    type: Object,
    default: {}
  }
}, { timestamps: true });

// Safe export for dev/hot-reload
module.exports = mongoose.models.Incident || mongoose.model('Incident', incidentSchema);
