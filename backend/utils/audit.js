const AuditEvent = require('../models/AuditEvent');

async function audit(type, actorId, role, payload, traceId) {
  await AuditEvent.create({ type, actorId, role, payload, traceId });
}

module.exports = { audit };
