import type { VercelRequest, VercelResponse } from '@vercel/node';
import { SiteSettingsSchema, defaultSiteSettings } from '../../src/types/siteSettings';

// Simple in-memory cache for local dev; on Vercel this resets between cold starts.
let MEM_SETTINGS = defaultSiteSettings;
let MEM_VERSION = defaultSiteSettings.version || 1;

function getActor(req: VercelRequest) {
  const auth = String(req.headers['authorization'] || '');
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : '';
  const cookie = String(req.headers['cookie'] || '');
  const match = cookie.match(/np_admin=([^;]+)/);
  return { token: bearer || (match ? decodeURIComponent(match[1]) : ''), role: 'admin' };
}

async function forwardToBackend(req: VercelRequest) {
  const base = process.env.ADMIN_BACKEND_URL?.replace(/\/$/, '');
  if (!base) return null;
  const url = `${base}/api/admin/settings`;
  const method = req.method || 'GET';
  const headers: Record<string,string> = {};
  for (const [k,v] of Object.entries(req.headers)) {
    if (!v) continue;
    const key = k.toLowerCase();
    if (['host','connection','content-length'].includes(key)) continue;
    headers[key] = Array.isArray(v) ? v.join(', ') : String(v);
  }
  headers['x-admin-proxy'] = 'vercel-settings';
  let body: any = undefined;
  if (!['GET','HEAD'].includes(method)) {
    body = req.body;
    if (body && typeof body === 'object') {
      headers['content-type'] = headers['content-type'] || 'application/json';
      body = JSON.stringify(body);
    }
  }
  const upstream = await fetch(url, { method, headers, body });
  const buf = Buffer.from(await upstream.arrayBuffer());
  return { upstream, buf } as const;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Prefer forwarding to real backend when configured
  if (process.env.ADMIN_BACKEND_URL) {
    try {
      const fwd = await forwardToBackend(req);
      if (fwd) {
        const { upstream, buf } = fwd;
        // GET should always return a full object; fallback to defaults if upstream fails or empty
        if (req.method === 'GET') {
          if (upstream.ok && buf.length > 0) {
            res.status(upstream.status);
            upstream.headers.forEach((value, key) => {
              if (key.toLowerCase() === 'content-encoding') return;
              res.setHeader(key, value);
            });
            return res.send(buf);
          }
          return res.status(200).json(defaultSiteSettings);
        }
        // For PUT/PATCH, attempt to forward; if failure, apply local merge fallback
        if (req.method === 'PUT' || req.method === 'PATCH') {
          if (upstream.ok && buf.length > 0) {
            res.status(upstream.status);
            upstream.headers.forEach((value, key) => {
              if (key.toLowerCase() === 'content-encoding') return;
              res.setHeader(key, value);
            });
            return res.send(buf);
          }
          // Fall through to local handling below
        } else {
          // Other methods (e.g., POST/DELETE): pass through upstream
          res.status(upstream.status);
          upstream.headers.forEach((value, key) => {
            if (key.toLowerCase() === 'content-encoding') return;
            res.setHeader(key, value);
          });
          return res.send(buf);
        }
      }
    } catch (e: any) {
      // Fallthrough to local demo mode
    }
  }

  // Demo/local fallback with basic validation and version bump + audit echo
  if (req.method === 'GET') {
    return res.status(200).json(MEM_SETTINGS || defaultSiteSettings);
  }
  if (req.method === 'PUT' || req.method === 'PATCH') {
    const parse = SiteSettingsSchema.safeParse({ ...MEM_SETTINGS, ...(req.body || {}) });
    if (!parse.success) {
      return res.status(400).json({ error: 'Invalid payload', issues: parse.error.issues });
    }
    MEM_VERSION += 1;
    MEM_SETTINGS = { ...parse.data, version: MEM_VERSION, updatedAt: new Date().toISOString() };
    // Minimal audit echo
    const actor = getActor(req);
    const action = String(req.headers['x-admin-action'] || 'update-settings');
    console.log('[audit]', { action, actorRole: actor.role, version: MEM_VERSION });
    return res.status(200).json(MEM_SETTINGS);
  }
  return res.status(405).json({ error: 'Method Not Allowed' });
}
