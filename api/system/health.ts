import type { VercelRequest, VercelResponse } from '@vercel/node';

// Serverless system health proxy for the dashboard and SafeZone panels.
// Always returns JSON with backend health data when available.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('content-type', 'application/json; charset=utf-8');

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const base = (process.env.ADMIN_BACKEND_URL || '').replace(/\/$/, '');
  if (!base) {
    return res.status(200).json({
      success: true,
      proxied: false,
      message: '🟢 Serverless health OK, but ADMIN_BACKEND_URL not set. Returning static status.',
      note: 'Set ADMIN_BACKEND_URL to proxy real backend health.'
    });
  }

  const candidates = [
    `${base}/api/system/health`,
    `${base}/api/health`,
  ];

  const fetchWithTimeout = async (url: string, timeoutMs = 4000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers: Record<string, string> = { accept: 'application/json' };
      if (req.headers.cookie) headers['cookie'] = req.headers.cookie;
      const started = Date.now();
      const resp = await fetch(url, { method: 'GET', headers, signal: controller.signal } as any);
      const ms = Date.now() - started;
      const ct = resp.headers.get('content-type') || '';
      let body: any = null;
      if (/application\/json/i.test(ct)) body = await resp.json().catch(() => ({ nonJson: true, text: '<invalid json>' }));
      else body = { nonJson: true, text: await resp.text().catch(() => '') };
      return { ok: resp.ok, status: resp.status, url, ms, contentType: ct, body };
    } finally {
      clearTimeout(id);
    }
  };

  for (const url of candidates) {
    try {
      const r = await fetchWithTimeout(url);
      if (r.ok) {
        return res.status(200).json({ success: true, proxied: true, target: r.url, status: r.status, latencyMs: r.ms, contentType: r.contentType, backend: r.body, ts: new Date().toISOString() });
      }
      return res.status(r.status || 502).json({ success: false, proxied: true, target: r.url, status: r.status, latencyMs: r.ms, contentType: r.contentType, backend: r.body, ts: new Date().toISOString() });
    } catch {}
  }

  return res.status(502).json({ success: false, proxied: true, error: 'Failed to reach backend health endpoints', tried: candidates, ts: new Date().toISOString() });
}
