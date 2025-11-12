const mongoose = require('mongoose');

const EscalationSchema = new mongoose.Schema({
  updatedAt: { type: Date, default: Date.now },
  levels: [{
    level: String,
    name: String,
    description: String,
    triggers: [String],
    autoLockdown: Boolean,
    channels: { dashboard: Boolean, email: Boolean, sms: Boolean, webhook: Boolean }
  }]
}, { versionKey: false });

module.exports = mongoose.model('Escalation', EscalationSchema);
