/**
 * Minimal audit feed endpoint for the Safe Owner Zone HUB.
 * Proxies to the backend /api/audit/recent when ADMIN_BACKEND_URL is configured.
 */
module.exports = async function handler(req, res) {
	res.setHeader('content-type', 'application/json; charset=utf-8');

	if (req.method !== 'GET') {
		res.statusCode = 405;
		return res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
	}

	const limitRaw = (req.query && (req.query.limit ?? 10)) ?? 10;
	const limit = Math.max(1, Math.min(50, Number(limitRaw)));

	const base = String(process.env.ADMIN_BACKEND_URL || '').replace(/\/+$/, '');
	if (!base) {
		res.statusCode = 200;
		return res.end(
			JSON.stringify({
				ok: true,
				proxied: false,
				items: [],
				limit,
				note: 'ADMIN_BACKEND_URL not set; returning empty audit list.',
				ts: new Date().toISOString(),
			})
		);
	}

	const url = `${base}/api/audit/recent?limit=${encodeURIComponent(String(limit))}`;
	try {
		const headers = { accept: 'application/json' };
		if (req.headers && req.headers.cookie) headers.cookie = String(req.headers.cookie);

		const resp = await fetch(url, { method: 'GET', headers });
		const ct = resp.headers.get('content-type') || '';
		const isJson = /application\/json/i.test(ct);
		const body = isJson ? await resp.json().catch(() => ({})) : { text: await resp.text().catch(() => '') };

		if (!resp.ok) {
			res.statusCode = resp.status || 502;
			return res.end(JSON.stringify({ ok: false, proxied: true, status: resp.status, target: url, backend: body }));
		}

		const items = Array.isArray(body?.items)
			? body.items.slice(0, limit)
			: Array.isArray(body)
				? body.slice(0, limit)
				: [];

		res.statusCode = 200;
		return res.end(JSON.stringify({ ok: true, proxied: true, target: url, items, limit, ts: new Date().toISOString() }));
	} catch (e) {
		res.statusCode = 502;
		return res.end(JSON.stringify({ ok: false, proxied: true, error: e?.message || 'Failed to fetch audit logs', target: url }));
	}
};
