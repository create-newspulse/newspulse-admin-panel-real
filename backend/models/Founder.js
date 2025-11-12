const mongoose = require('mongoose');

const FounderSchema = new mongoose.Schema({
  pinHash: { type: String },
  updatedAt: { type: Date, default: Date.now }
}, { versionKey: false });

module.exports = mongoose.model('Founder', FounderSchema);
