// Vercel catch-all proxy: /api/admin-proxy/* -> ADMIN_BACKEND_URL/*
// Use with vercel.json rewrite: { "source": "/admin-api/(.*)", "destination": "/api/admin-proxy/$1" }
// Set ADMIN_BACKEND_URL in Vercel Project Settings (e.g., https://api.yourdomain.com)

function buildTargetUrl(base, path, query) {
  const target = new URL(path, base);
  for (const [k, v] of Object.entries(query || {})) {
    if (Array.isArray(v)) v.forEach((vv) => target.searchParams.append(k, vv));
    else if (v != null) target.searchParams.append(k, String(v));
  }
  return target.toString();
}

export default async function handler(req, res) {
  const base = process.env.ADMIN_BACKEND_URL || process.env.VITE_API_URL;
  if (!base) {
    return res.status(500).json({ error: 'missing_backend', message: 'ADMIN_BACKEND_URL (or VITE_API_URL) is not set in environment' });
  }
  try {
    const segments = req.query.path;
    const subPath = Array.isArray(segments) ? segments.join('/') : String(segments || '');
    const targetUrl = buildTargetUrl(base.endsWith('/') ? base : base + '/', subPath, req.query);

    const headers = { ...req.headers };
    // Remove hop-by-hop/host headers not suitable for proxying
    delete headers['host'];
    delete headers['content-length'];
    delete headers['connection'];

    const method = req.method || 'GET';
    const hasBody = !['GET', 'HEAD'].includes(method.toUpperCase());
    const body = hasBody ? (typeof req.body === 'string' ? req.body : req.body ? JSON.stringify(req.body) : undefined) : undefined;
    if (body && !headers['content-type']) {
      headers['content-type'] = 'application/json';
    }

    const response = await fetch(targetUrl, {
      method,
      headers,
      body,
    });

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const status = response.status;
    const buf = Buffer.from(await response.arrayBuffer());

    res.status(status).setHeader('content-type', contentType);
    // Optionally forward other headers
    const passHeaders = ['cache-control', 'x-ratelimit-remaining'];
    passHeaders.forEach((h) => {
      const v = response.headers.get(h);
      if (v) res.setHeader(h, v);
    });

    return res.send(buf);
  } catch (err) {
    console.error('admin-proxy error:', err);
    return res.status(502).json({ error: 'bad_gateway', message: String(err) });
  }
}
