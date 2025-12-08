// backend/routes/security/audit-trail.mjs
// Zero-Trust Audit Trail System (ESM clone for CommonJS package)

import express from 'express';
const router = express.Router();

// In-memory audit store (replace with MongoDB in production)
const auditLog = [];
let auditIdCounter = 1;

/**
 * Log an audit event
 * POST /api/security/audit
 * Body: { actor, action, entity, entityId, metadata, ip, userAgent }
 */
router.post('/', (req, res) => {
	const { actor, action, entity, entityId, metadata = {}, ip, userAgent } = req.body;

	if (!actor || !action || !entity) {
		return res.status(400).json({ success: false, message: 'Missing required fields: actor, action, entity' });
	}

	const auditEntry = {
		id: auditIdCounter++,
		actor, // email or user ID
		action, // 'login', 'create', 'update', 'delete', 'publish', 'role_change', etc.
		entity, // 'user', 'story', 'category', 'settings', etc.
		entityId, // ID of the affected entity
		metadata, // { before: ..., after: ..., reason: ... }
		ip: ip || req.ip || req.headers['x-forwarded-for'] || 'unknown',
		userAgent: userAgent || req.headers['user-agent'] || 'unknown',
		timestamp: new Date().toISOString(),
	};

	auditLog.push(auditEntry);

	// Keep only last 10,000 entries in memory (for demo; use DB in prod)
	if (auditLog.length > 10000) {
		auditLog.shift();
	}

	return res.json({ success: true, auditId: auditEntry.id, message: 'Audit logged' });
});

/**
 * Query audit trail
 * GET /api/security/audit?actor=&action=&entity=&limit=&offset=
 */
router.get('/', (req, res) => {
	const { actor, action, entity, limit = 100, offset = 0 } = req.query;

	let filtered = [...auditLog].reverse(); // newest first

	if (actor) {
		filtered = filtered.filter((e) => e.actor.toLowerCase().includes(actor.toLowerCase()));
	}
	if (action) {
		filtered = filtered.filter((e) => e.action.toLowerCase().includes(action.toLowerCase()));
	}
	if (entity) {
		filtered = filtered.filter((e) => e.entity.toLowerCase().includes(entity.toLowerCase()));
	}

	const total = filtered.length;
	const paginated = filtered.slice(Number(offset), Number(offset) + Number(limit));

	return res.json({
		success: true,
		total,
		limit: Number(limit),
		offset: Number(offset),
		entries: paginated,
	});
});

/**
 * Get audit stats
 * GET /api/security/audit/stats
 */
router.get('/stats', (req, res) => {
	const stats = {
		totalEvents: auditLog.length,
		last24h: auditLog.filter((e) => Date.now() - new Date(e.timestamp).getTime() < 24 * 60 * 60 * 1000).length,
		topActors: getTopN(auditLog, 'actor', 5),
		topActions: getTopN(auditLog, 'action', 5),
		topEntities: getTopN(auditLog, 'entity', 5),
	};
	return res.json({ success: true, stats });
});

function getTopN(logs, key, n) {
	const counts = {};
	logs.forEach((log) => {
		const val = log[key];
		counts[val] = (counts[val] || 0) + 1;
	});
	return Object.entries(counts)
		.sort((a, b) => b[1] - a[1])
		.slice(0, n)
		.map(([k, v]) => ({ [key]: k, count: v }));
}

// Seed some sample data
if (auditLog.length === 0) {
	const sampleEvents = [
		{ actor: 'founder@newspulse.com', action: 'login', entity: 'user', entityId: 'u1', metadata: { method: 'password' }, ip: '203.0.113.45', userAgent: 'Mozilla/5.0' },
		{ actor: 'editor@newspulse.com', action: 'publish', entity: 'story', entityId: 's42', metadata: { title: 'Breaking: Elections 2025' }, ip: '203.0.113.46', userAgent: 'Mozilla/5.0' },
		{ actor: 'founder@newspulse.com', action: 'role_change', entity: 'user', entityId: 'u5', metadata: { before: 'editor', after: 'admin' }, ip: '203.0.113.45', userAgent: 'Mozilla/5.0' },
		{ actor: 'admin@newspulse.com', action: 'delete', entity: 'story', entityId: 's38', metadata: { reason: 'duplicate' }, ip: '203.0.113.47', userAgent: 'Mozilla/5.0' },
		{ actor: 'editor@newspulse.com', action: 'create', entity: 'category', entityId: 'c12', metadata: { name: 'Tech' }, ip: '203.0.113.46', userAgent: 'Mozilla/5.0' },
	];
	sampleEvents.forEach((e, i) => {
		auditLog.push({ ...e, id: auditIdCounter++, timestamp: new Date(Date.now() - i * 60000).toISOString() });
	});
}

export default router;