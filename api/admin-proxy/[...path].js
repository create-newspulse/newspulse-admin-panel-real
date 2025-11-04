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
export default async function handler(req, res) {
    try {
        for (const key of REQUIRED_ENV) {
            if (!process.env[key]) {
                return res.status(500).json({ error: `Missing env ${key}` });
            }
        }
        const backendBase = process.env.ADMIN_BACKEND_URL.replace(/\/$/, '');
        const secret = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET);
        // Check session cookie
        const cookies = parseCookies(req.headers.cookie);
        const token = cookies['np_admin'];
        if (!token)
            return res.status(401).json({ error: 'Unauthorized' });
        // Verify session JWT
        try {
            await jwtVerify(token, secret, { audience: 'admin', issuer: 'newspulse' });
        }
        catch (e) {
            const err = e;
            return res.status(401).json({ error: 'Invalid session', detail: err.message });
        }
        const pathParam = req.query.path || [];
        const joinedPath = pathParam.join('/');
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
        let body = undefined;
        if (!['GET', 'HEAD'].includes(method)) {
            body = req.body;
            // Vercel passes parsed body for JSON. Ensure proper serialization.
            if (body && typeof body === 'object' && !(body instanceof Buffer)) {
                headers['content-type'] = headers['content-type'] || 'application/json';
                body = JSON.stringify(body);
            }
        }
        const resp = await fetch(targetUrl.toString(), { method, headers, body });
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
        return res.status(500).json({ error: 'Proxy failure' });
    }
}
