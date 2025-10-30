// Vercel Serverless Function: health
// Used by vercel.json cron to ping and report backend health

export const config = { runtime: 'edge' };

export default async function handler() {
  const backend = process.env.ADMIN_BACKEND_URL || process.env.VITE_API_URL;
  const ts = new Date().toISOString();
  if (!backend) {
    return new Response(JSON.stringify({ ok: false, ts, error: 'ADMIN_BACKEND_URL not set' }), {
      status: 500,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  }
  try {
    const r = await fetch(`${backend.replace(/\/$/, '')}/api/system/health`, { cache: 'no-store' });
    const ct = r.headers.get('content-type') || '';
    const data = ct.includes('application/json') ? await r.json() : await r.text();
    return new Response(JSON.stringify({ ok: r.ok, backend, status: r.status, data, ts }), {
      status: 200,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, backend, error: String(e), ts }), {
      status: 502,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  }
}

