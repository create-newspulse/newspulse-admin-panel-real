// Vercel Serverless Function: Admin Proxy
// Proxies requests from /admin-api/* to your trusted backend (ADMIN_BACKEND_URL)
// Requires a valid admin session cookie (np_admin) signed with ADMIN_JWT_SECRET.
import { jwtVerify } from 'jose';
// Simple cookie parser
function parseCookies(header) {
    const cookies = {};
    if (!header)
        return cookies;
    header.split(';').forEach((c) => {
        const [k, ...rest] = c.trim().split('=');
        cookies[k] = decodeURIComponent(rest.join('='));
    });
    return cookies;
}
const REQUIRED_ENV = ['ADMIN_BACKEND_URL', 'ADMIN_JWT_SECRET'];

// Simple host recursion guard (avoid misconfiguration where ADMIN_BACKEND_URL points back to the Vercel site)
function isRecursiveTarget(backendBase, reqHost) {
    try {
        const b = new URL(backendBase);
        const hostA = (b.host || '').toLowerCase();
        const hostB = (reqHost || '').toLowerCase();
        return hostA === hostB;
    } catch { return false; }
}
export default async function handler(req, res) {
    try {
        for (const key of REQUIRED_ENV) {
            if (!process.env[key]) {
                return res.status(500).json({ error: `Missing env ${key}` });
            }
        }
        const backendBase = process.env.ADMIN_BACKEND_URL.replace(/\/$/, '');
        // Guard against recursion (calling proxy -> proxy) which can manifest as 405 or timeouts
        if (isRecursiveTarget(backendBase, req.headers.host)) {
            return res.status(500).json({ error: 'ADMIN_BACKEND_URL points to the frontend host. Set it to your backend origin (e.g. https://api.yourdomain.com or Render URL).', host: req.headers.host });
        }
    // Use ADMIN_JWT_SECRET if set, otherwise fall back to JWT_SECRET to align with backend router
    const secretValue = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;
    const secret = new TextEncoder().encode(secretValue);
        const pathParam = req.query.path || [];
        const joinedPath = pathParam.join('/');
        // Allow unauthenticated access for explicit public endpoints
        // - admin/login: credential-based login to obtain a JWT (no session yet)
        // - admin/auth/ping: health check
        const isPublic = joinedPath === 'admin/login' || joinedPath === 'admin/auth/ping';

        // Check session/token only for non-public endpoints
        if (!isPublic) {
            // ✅ Accept either cookie np_admin OR Authorization: Bearer <jwt>
            // This aligns with SPA flows that store JWT in localStorage and send Authorization header.
            const authHeader = (req.headers['authorization'] || req.headers['Authorization'] || '').toString();
            const bearer = authHeader.toLowerCase().startsWith('bearer ')
                ? authHeader.slice(7).trim()
                : '';
            const cookies = parseCookies(req.headers.cookie);
            const cookieToken = cookies['np_admin'];
            const tokenToVerify = bearer || cookieToken;
            if (!tokenToVerify)
                return res.status(401).json({ error: 'Unauthorized' });
            // Verify session JWT
            try {
                // First attempt: permissive (no audience/issuer) for legacy tokens
                await jwtVerify(tokenToVerify, secret);
            } catch (e1) {
                try {
                    // Second attempt: strict claims if present
                    await jwtVerify(tokenToVerify, secret, { audience: 'admin', issuer: 'newspulse' });
                } catch (e2) {
                    const err = e2 || e1;
                    return res.status(401).json({ error: 'Invalid session', detail: err.message });
                }
            }
        }
    const targetUrl = new URL(`${backendBase}/api/${joinedPath}`);
        // Append query string
        const q = req.query;
        Object.keys(q).forEach((k) => {
            if (k !== 'path') {
                const v = q[k];
                if (Array.isArray(v))
                    v.forEach((vv) => targetUrl.searchParams.append(k, String(vv)));
                else if (v != null)
                    targetUrl.searchParams.append(k, String(v));
            }
        });
        // Prepare fetch options
        const method = req.method || 'GET';
    const headers = {};
        for (const [k, v] of Object.entries(req.headers)) {
            if (!v)
                continue;
            const key = k.toLowerCase();
            if (['host', 'connection', 'content-length'].includes(key))
                continue;
            headers[key] = Array.isArray(v) ? v.join(', ') : String(v);
        }
        // Always forward cookies to backend if any (session is only validated at proxy)
        if (req.headers.cookie)
            headers['cookie'] = req.headers.cookie;
        // Signal downstream this came via proxy (useful for debugging backend logs)
        headers['x-admin-proxy'] = 'vercel';
        let body = undefined;
        if (!['GET', 'HEAD'].includes(method)) {
            body = req.body;
            // Vercel passes parsed body for JSON. Ensure proper serialization.
            if (body && typeof body === 'object' && !(body instanceof Buffer)) {
                headers['content-type'] = headers['content-type'] || 'application/json';
                body = JSON.stringify(body);
            }
        }
        let resp;
        try {
            resp = await fetch(targetUrl.toString(), { method, headers, body });
        } catch (fetchErr) {
            console.error('Proxy fetch error:', fetchErr);
            return res.status(502).json({ error: 'Upstream unreachable', detail: fetchErr.message || String(fetchErr) });
        }
        // Buffer body first so we can optionally transform certain upstream errors (rate limits)
        const buf = Buffer.from(await resp.arrayBuffer());

        // Soft-fallback for KiranOS ask endpoints when upstream is rate limited or out of quota
        try {
            const isAskRoute = /kiranos\/ask|system\/ask-kiranos/i.test(joinedPath);
            const wantSoft = (process.env.AI_PROXY_SOFT_FAIL || '1') !== '0';
            if (isAskRoute && wantSoft && (resp.status === 429 || resp.status === 500)) {
                // Inspect JSON body (if any) to detect quota/rate-limit signals
                const ctype = String(resp.headers.get('content-type') || '');
                const looksJson = ctype.includes('application/json') || ctype.includes('text/json') || ctype.includes('json');
                let payload = null;
                if (looksJson) {
                    try { payload = JSON.parse(buf.toString('utf8')); } catch { payload = null; }
                }
                const raw = (payload && (payload.detail || payload.error || JSON.stringify(payload))) || buf.toString('utf8');
                const quotaHit = /\b429\b|quota|rate limit|too many requests/i.test(raw);
                if (quotaHit) {
                    return res.status(200).json({ success: true, answer: '⏳ KiranOS is busy right now (provider limit). Please try again in a few seconds.', error: null, softFallback: true });
                }
            }
        } catch { /* fall through to normal forwarding */ }

        // Stream through status and headers (default path)
        res.status(resp.status);
        resp.headers.forEach((value, key) => {
            if (key.toLowerCase() === 'content-encoding')
                return; // avoid compressed re-send
            res.setHeader(key, value);
        });
        return res.send(buf);
    }
    catch (err) {
        console.error('Admin proxy error:', err);
        return res.status(500).json({ error: 'Proxy failure', detail: err?.message || String(err) });
    }
}
