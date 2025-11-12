// Vercel Serverless Function: Admin Proxy (admin subproject)
// Mirrors the root-level /api/admin-proxy to support projects whose Vercel root is ./admin
import { jwtVerify } from 'jose';

function parseCookies(header) {
  const cookies = {};
  if (!header) return cookies;
  header.split(';').forEach((c) => {
    const [k, ...rest] = c.trim().split('=');
    cookies[k] = decodeURIComponent(rest.join('='));
  });
  return cookies;
}

const REQUIRED_ENV = ['ADMIN_BACKEND_URL', 'ADMIN_JWT_SECRET'];

export default async function handler(req, res) {
  try {
    for (const key of REQUIRED_ENV) {
      if (!process.env[key]) {
        return res.status(500).json({ error: `Missing env ${key}` });
      }
    }

    const backendBase = process.env.ADMIN_BACKEND_URL.replace(/\/$/, '');
    const secret = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET);

    const pathParam = req.query.path || [];
    const joinedPath = pathParam.join('/');

    // Public endpoints (no auth required)
    const isPublic = joinedPath === 'admin/login' || joinedPath === 'admin/auth/ping';

    if (!isPublic) {
      const authHeader = (req.headers['authorization'] || req.headers['Authorization'] || '').toString();
      const bearer = authHeader.toLowerCase().startsWith('bearer ')
        ? authHeader.slice(7).trim()
        : '';
      const cookies = parseCookies(req.headers.cookie);
      const cookieToken = cookies['np_admin'];
      const tokenToVerify = bearer || cookieToken;
      if (!tokenToVerify) return res.status(401).json({ error: 'Unauthorized' });
      try {
        await jwtVerify(tokenToVerify, secret, { audience: 'admin', issuer: 'newspulse' });
      } catch (e) {
        const err = e;
        return res.status(401).json({ error: 'Invalid session', detail: err.message });
      }
    }

    const targetUrl = new URL(`${backendBase}/api/${joinedPath}`);

    // Forward query params
    const q = req.query || {};
    for (const k of Object.keys(q)) {
      if (k === 'path') continue;
      const v = q[k];
      if (Array.isArray(v)) v.forEach((vv) => targetUrl.searchParams.append(k, String(vv)));
      else if (v != null) targetUrl.searchParams.append(k, String(v));
    }

    // Forward headers/body
    const method = req.method || 'GET';
    const headers = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (!v) continue;
      const key = k.toLowerCase();
      if (['host', 'connection', 'content-length'].includes(key)) continue;
      headers[key] = Array.isArray(v) ? v.join(', ') : String(v);
    }
    if (req.headers.cookie) headers['cookie'] = req.headers.cookie;

    let body = undefined;
    if (!['GET', 'HEAD'].includes(method)) {
      body = req.body;
      if (body && typeof body === 'object' && !(body instanceof Buffer)) {
        headers['content-type'] = headers['content-type'] || 'application/json';
        body = JSON.stringify(body);
      }
    }

    const resp = await fetch(targetUrl.toString(), { method, headers, body });
    const buf = Buffer.from(await resp.arrayBuffer());

    res.status(resp.status);
    resp.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'content-encoding') return;
      res.setHeader(key, value);
    });
    return res.send(buf);
  } catch (err) {
    console.error('Admin proxy (admin/) error:', err);
    return res.status(500).json({ error: 'Proxy failure' });
  }
}
