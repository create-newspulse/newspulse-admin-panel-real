const mongoose = require('mongoose');

const AuditEventSchema = new mongoose.Schema({
  type: String,
  actorId: String,
  role: String,
  payload: mongoose.Schema.Types.Mixed,
  traceId: String,
  ts: { type: Date, default: Date.now }
}, { versionKey: false });

module.exports = mongoose.model('AuditEvent', AuditEventSchema);
