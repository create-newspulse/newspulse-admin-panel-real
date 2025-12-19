import type { VercelRequest, VercelResponse } from '@vercel/node';

// Minimal audit feed endpoint for the Safe Owner Zone HUB.
// Proxies to the backend /api/audit/recent when ADMIN_BACKEND_URL is configured.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('content-type', 'application/json; charset=utf-8');

  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const limit = Math.max(1, Math.min(50, Number(req.query.limit ?? 10)));

  const base = (process.env.ADMIN_BACKEND_URL || '').replace(/\/+$/, '');
  if (!base) {
    // Safe fallback for local/dev without backend.
    return res.status(200).json({
      ok: true,
      proxied: false,
      items: [],
      limit,
      note: 'ADMIN_BACKEND_URL not set; returning empty audit list.',
      ts: new Date().toISOString(),
    });
  }

  const url = `${base}/api/audit/recent?limit=${encodeURIComponent(String(limit))}`;
  try {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (req.headers.cookie) headers.cookie = String(req.headers.cookie);

    const resp = await fetch(url, { method: 'GET', headers } as any);
    const ct = resp.headers.get('content-type') || '';
    const isJson = /application\/json/i.test(ct);
    const body = isJson ? await resp.json().catch(() => ({})) : { text: await resp.text().catch(() => '') };

    if (!resp.ok) {
      return res.status(resp.status).json({ ok: false, proxied: true, status: resp.status, target: url, backend: body });
    }

    const items = Array.isArray((body as any)?.items) ? (body as any).items.slice(0, limit) : Array.isArray(body) ? (body as any).slice(0, limit) : [];
    return res.status(200).json({ ok: true, proxied: true, target: url, items, limit, ts: new Date().toISOString() });
  } catch (e: any) {
    return res.status(502).json({ ok: false, proxied: true, error: e?.message || 'Failed to fetch audit logs', target: url });
  }
}
