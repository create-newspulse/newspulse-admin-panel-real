import type { VercelRequest, VercelResponse } from '@vercel/node';
import { jwtVerify } from 'jose';

// Simple cookie parser
function parseCookies(header?: string) {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  header.split(';').forEach((c) => {
    const [k, ...rest] = c.trim().split('=');
    cookies[k] = decodeURIComponent(rest.join('='));
  });
  return cookies;
}

function isRecursiveTarget(backendBase: string, reqHost?: string) {
  try {
    const b = new URL(backendBase);
    const hostA = (b.host || '').toLowerCase();
    const hostB = (reqHost || '').toLowerCase();
    return hostA === hostB;
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const backendRaw = process.env.ADMIN_BACKEND_URL;
    if (!backendRaw) return res.status(500).json({ error: 'Missing env ADMIN_BACKEND_URL' });

    const backendBase = backendRaw.replace(/\/$/, '');
    if (isRecursiveTarget(backendBase, req.headers.host)) {
      return res.status(500).json({
        error: 'ADMIN_BACKEND_URL points to the frontend host. Set it to your backend origin.',
        host: req.headers.host,
      });
    }

    // Session validation: accept np_admin cookie or Bearer token
    const authHeader = String(req.headers['authorization'] || req.headers['Authorization'] || '');
    const bearer = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
    const cookies = parseCookies(req.headers.cookie);
    const cookieToken = cookies['np_admin'];
    const tokenToVerify = bearer || cookieToken;
    if (!tokenToVerify) return res.status(401).json({ error: 'Unauthorized' });

    const secretValue = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || '';
    const secret = secretValue ? new TextEncoder().encode(secretValue) : null;

    // Soft mode: only verify when secret exists and token looks like JWT.
    const looksJwt = typeof tokenToVerify === 'string' && tokenToVerify.split('.').length === 3;
    if (secret && looksJwt) {
      try {
        await jwtVerify(tokenToVerify, secret);
      } catch (e1: any) {
        try {
          await jwtVerify(tokenToVerify, secret, { audience: 'admin', issuer: 'newspulse' });
        } catch (e2: any) {
          const err = e2 || e1;
          return res.status(401).json({ error: 'Invalid session', detail: err?.message || String(err) });
        }
      }
    }

    const pathParam = (req.query.path as string[]) || [];
    const joinedPath = pathParam.join('/');

    const targetUrl = new URL(`${backendBase}/api/owner/passkey/${joinedPath}`);

    // Append query string
    for (const [k, v] of Object.entries(req.query)) {
      if (k === 'path') continue;
      if (Array.isArray(v)) v.forEach((vv) => targetUrl.searchParams.append(k, String(vv)));
      else if (v != null) targetUrl.searchParams.append(k, String(v));
    }

    const method = req.method || 'GET';

    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (!v) continue;
      const key = k.toLowerCase();
      if (['host', 'connection', 'content-length'].includes(key)) continue;
      headers[key] = Array.isArray(v) ? v.join(', ') : String(v);
    }

    // Forward cookies/session to backend
    if (req.headers.cookie) headers['cookie'] = req.headers.cookie;

    headers['x-owner-passkey-proxy'] = 'vercel';

    let body: any = undefined;
    if (!['GET', 'HEAD'].includes(method)) {
      body = req.body;
      if (body && typeof body === 'object' && !(body instanceof Buffer)) {
        headers['content-type'] = headers['content-type'] || 'application/json';
        body = JSON.stringify(body);
      }
    }

    let upstream: Response;
    try {
      upstream = await fetch(targetUrl.toString(), { method, headers, body });
    } catch (fetchErr: any) {
      console.error('Owner passkey proxy fetch error:', fetchErr);
      return res.status(502).json({ error: 'Upstream unreachable', detail: fetchErr?.message || String(fetchErr) });
    }

    const buf = Buffer.from(await upstream.arrayBuffer());

    res.status(upstream.status);
    upstream.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'content-encoding') return;
      res.setHeader(key, value);
    });

    return res.send(buf);
  } catch (err: any) {
    console.error('Owner passkey proxy error:', err);
    return res.status(500).json({ error: 'Proxy failure', detail: err?.message || String(err) });
  }
}
