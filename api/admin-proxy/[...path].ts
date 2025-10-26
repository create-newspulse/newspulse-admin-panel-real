// Vercel Serverless Function: Admin Proxy
// Proxies requests from /admin-api/* to your trusted backend (ADMIN_BACKEND_URL)
// Requires a valid admin session cookie (np_admin) signed with ADMIN_JWT_SECRET.

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

const REQUIRED_ENV = ['ADMIN_BACKEND_URL', 'ADMIN_JWT_SECRET'] as const;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    for (const key of REQUIRED_ENV) {
      if (!process.env[key]) {
        return res.status(500).json({ error: `Missing env ${key}` });
      }
    }

    const backendBase = process.env.ADMIN_BACKEND_URL!.replace(/\/$/, '');
    const secret = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET!);

    // Check session cookie
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies['np_admin'];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    // Verify session JWT
    try {
      await jwtVerify(token, secret, { audience: 'admin', issuer: 'newspulse' });
    } catch (e) {
      const err = e as Error;
      return res.status(401).json({ error: 'Invalid session', detail: err.message });
    }

    const pathParam = (req.query.path as string[]) || [];
    const joinedPath = pathParam.join('/');
    const targetUrl = new URL(`${backendBase}/api/${joinedPath}`);

    // Append query string
    const q = req.query;
    Object.keys(q).forEach((k) => {
      if (k !== 'path') {
        const v = q[k];
        if (Array.isArray(v)) v.forEach((vv) => targetUrl.searchParams.append(k, String(vv)));
        else if (v != null) targetUrl.searchParams.append(k, String(v));
      }
    });

    // Prepare fetch options
    const method = req.method || 'GET';
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (!v) continue;
      const key = k.toLowerCase();
      if (['host', 'connection', 'content-length'].includes(key)) continue;
      headers[key] = Array.isArray(v) ? v.join(', ') : String(v);
    }
    // Always forward cookies to backend if any (session is only validated at proxy)
    if (req.headers.cookie) headers['cookie'] = req.headers.cookie;

    let body: any = undefined;
    if (!['GET', 'HEAD'].includes(method)) {
      body = req.body;
      // Vercel passes parsed body for JSON. Ensure proper serialization.
      if (body && typeof body === 'object' && !(body instanceof Buffer)) {
        headers['content-type'] = headers['content-type'] || 'application/json';
        body = JSON.stringify(body);
      }
    }

    const resp = await fetch(targetUrl.toString(), { method, headers, body } as any);

    // Stream through status and headers
    res.status(resp.status);
    resp.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'content-encoding') return; // avoid compressed re-send
      res.setHeader(key, value);
    });

    // Buffer the body to send once
    const buf = Buffer.from(await resp.arrayBuffer());
    return res.send(buf);
  } catch (err) {
    console.error('Admin proxy error:', err);
    return res.status(500).json({ error: 'Proxy failure' });
  }
}
