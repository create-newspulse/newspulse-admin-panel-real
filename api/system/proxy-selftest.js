// Quick self-test endpoint to diagnose proxy 405/recursion/missing env on Vercel
export default async function handler(req, res) {
  try {
    const host = req.headers.host || '';
    const backend = (process.env.ADMIN_BACKEND_URL || '').replace(/\/$/, '');
    const secretSet = !!process.env.ADMIN_JWT_SECRET;
    let recursion = false;
    let health = null;
    let ping = null;
    let errors = [];

    // Basic checks
    if (!backend) errors.push('ADMIN_BACKEND_URL is not set');
    if (!secretSet) errors.push('ADMIN_JWT_SECRET is not set');

    // Recursion guard
    try {
      if (backend) {
        const u = new URL(backend);
        recursion = (u.host || '').toLowerCase() === String(host).toLowerCase();
      }
    } catch {}

    // Try backend health
    if (backend && !recursion) {
      try {
        const r = await fetch(`${backend}/api/health`, { method: 'GET', headers: { 'x-proxy-selftest': '1' } });
        let body;
        try { body = await r.json(); } catch {
          try { body = { raw: await r.text() }; } catch { body = null; }
        }
        health = { ok: r.ok, status: r.status, body };
      } catch (e) {
        errors.push('Fetch to backend /api/health failed: ' + (e?.message || String(e)));
      }
    }

    // Try admin ping via proxy path (does not require auth in proxy)
    try {
      const r = await fetch(`${req.headers['x-forwarded-proto'] || 'https'}://${host}/admin-api/admin/auth/ping`, { method: 'GET' });
      const txt = await r.text();
      ping = { ok: r.ok, status: r.status, text: txt.slice(0, 200) };
    } catch (e) {
      errors.push('Proxy ping failed: ' + (e?.message || String(e)));
    }

    res.status(200).json({
      ok: errors.length === 0,
      host,
      backend,
      secretSet,
      recursion,
      health,
      ping,
      errors,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
}
