// Vercel Serverless Function: /api/system/health
// - If ADMIN_BACKEND_URL is set, proxy to `${ADMIN_BACKEND_URL}/api/system/health`
// - Otherwise, just return a lightweight 200 JSON

export default async function handler(req, res) {
  try {
    const base = process.env.ADMIN_BACKEND_URL || process.env.VITE_API_URL;
    if (base) {
      const url = new URL('/api/system/health', base).toString();
      const r = await fetch(url, { method: 'GET', headers: { 'accept': 'application/json' } });
      const text = await r.text();
      // Try to preserve JSON if possible
      res.status(r.status).setHeader('content-type', r.headers.get('content-type') || 'application/json');
      return res.send(text);
    }
    res.status(200).json({ ok: true, source: 'vercel', timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('health proxy error:', err);
    res.status(502).json({ ok: false, error: 'backend_unreachable', message: String(err) });
  }
}
