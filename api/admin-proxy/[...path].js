// Vercel Serverless Function: Admin Proxy
// Proxies requests from /admin-api/* to your trusted backend (ADMIN_BACKEND_URL)
// Validates admin session via cookie or Bearer token.
// If ADMIN_JWT_SECRET/JWT_SECRET is provided and the token looks like a JWT, it will be verified.
// Otherwise, presence of a session token/cookie is accepted (soft mode) to support simpler backends.
import { jwtVerify } from 'jose';
import Busboy from 'busboy';
import crypto from 'crypto';

const MAX_COVER_BYTES = 5 * 1024 * 1024;

function parseCloudinaryConfig() {
    const rawUrl = (process.env.CLOUDINARY_URL || '').toString().trim();
    let cloudName = (process.env.CLOUDINARY_CLOUD_NAME || '').toString().trim();
    let apiKey = (process.env.CLOUDINARY_API_KEY || '').toString().trim();
    let apiSecret = (process.env.CLOUDINARY_API_SECRET || '').toString().trim();

    if (rawUrl && (!cloudName || !apiKey || !apiSecret)) {
        try {
            const u = new URL(rawUrl);
            // cloudinary://API_KEY:API_SECRET@CLOUD_NAME
            if (u.username && !apiKey) apiKey = decodeURIComponent(u.username);
            if (u.password && !apiSecret) apiSecret = decodeURIComponent(u.password);
            if (u.hostname && !cloudName) cloudName = u.hostname;
        } catch {
            // ignore
        }
    }

    const folder = (process.env.CLOUDINARY_FOLDER_COVERS || process.env.CLOUDINARY_FOLDER || '').toString().trim();

    if (!cloudName || !apiKey || !apiSecret) return null;
    return { cloudName, apiKey, apiSecret, folder };
}

function sha1Hex(input) {
    return crypto.createHash('sha1').update(input).digest('hex');
}

function signCloudinaryParams(params, apiSecret) {
    const keys = Object.keys(params).filter((k) => params[k] != null && String(params[k]).trim() !== '').sort();
    const toSign = keys.map((k) => `${k}=${params[k]}`).join('&');
    return sha1Hex(`${toSign}${apiSecret}`);
}

async function parseMultipartCoverFile(req) {
    return await new Promise((resolve, reject) => {
        const bb = Busboy({
            headers: req.headers,
            limits: { files: 1, fileSize: MAX_COVER_BYTES },
        });

        let picked = null;
        let pickedField = '';
        let filename = '';
        let mimeType = '';
        const chunks = [];
        let total = 0;

        bb.on('file', (fieldname, file, info) => {
            const fn = info?.filename || '';
            const mt = info?.mimeType || info?.mimetype || '';

            const isCandidate = fieldname === 'cover' || fieldname === 'file';
            if (!isCandidate) {
                file.resume();
                return;
            }
            if (picked) {
                file.resume();
                return;
            }

            picked = file;
            pickedField = fieldname;
            filename = String(fn || 'cover');
            mimeType = String(mt || 'application/octet-stream');

            file.on('data', (d) => {
                total += d.length;
                chunks.push(d);
            });
            file.on('limit', () => {
                reject(Object.assign(new Error('File too large'), { statusCode: 413 }));
            });
            file.on('error', reject);
        });

        bb.on('error', reject);
        bb.on('finish', () => {
            if (!picked) {
                reject(Object.assign(new Error('Missing file field "cover"'), { statusCode: 400 }));
                return;
            }
            resolve({
                field: pickedField,
                filename,
                mimeType,
                size: total,
                buffer: Buffer.concat(chunks),
            });
        });

        req.pipe(bb);
    });
}

async function handleCoverUpload(req, res) {
    if ((req.method || 'GET').toUpperCase() === 'OPTIONS') {
        res.setHeader('Allow', 'OPTIONS, POST');
        return res.status(204).end();
    }
    if ((req.method || 'GET').toUpperCase() !== 'POST') {
        res.setHeader('Allow', 'OPTIONS, POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const cfg = parseCloudinaryConfig();
    if (!cfg) {
        return res.status(500).json({
            error: 'Cloudinary is not configured',
            detail: 'Set CLOUDINARY_URL (preferred) or CLOUDINARY_CLOUD_NAME + CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET',
        });
    }

    const ctype = String(req.headers['content-type'] || '');
    if (!ctype.toLowerCase().includes('multipart/form-data')) {
        return res.status(400).json({ error: 'Expected multipart/form-data' });
    }

    let filePart;
    try {
        filePart = await parseMultipartCoverFile(req);
    } catch (e) {
        const status = e?.statusCode || 400;
        return res.status(status).json({ error: e?.message || 'Invalid upload' });
    }

    if (!filePart?.buffer || !filePart.buffer.length) {
        return res.status(400).json({ error: 'Empty file' });
    }
    if (filePart.buffer.length > MAX_COVER_BYTES) {
        return res.status(413).json({ error: 'File too large (max 5MB)' });
    }
    if (filePart.mimeType && !String(filePart.mimeType).toLowerCase().startsWith('image/')) {
        return res.status(400).json({ error: 'Only image uploads are allowed' });
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const paramsToSign = {
        timestamp,
        ...(cfg.folder ? { folder: cfg.folder } : {}),
    };
    const signature = signCloudinaryParams(paramsToSign, cfg.apiSecret);

    const fd = new FormData();
    fd.append('file', new Blob([filePart.buffer], { type: filePart.mimeType || 'application/octet-stream' }), filePart.filename || 'cover');
    fd.append('api_key', cfg.apiKey);
    fd.append('timestamp', String(timestamp));
    if (cfg.folder) fd.append('folder', cfg.folder);
    fd.append('signature', signature);

    const uploadUrl = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cfg.cloudName)}/image/upload`;

    let upstream;
    try {
        upstream = await fetch(uploadUrl, { method: 'POST', body: fd });
    } catch (fetchErr) {
        return res.status(502).json({ error: 'Cloudinary unreachable', detail: fetchErr?.message || String(fetchErr) });
    }

    let payload;
    try {
        payload = await upstream.json();
    } catch {
        payload = null;
    }

    if (!upstream.ok) {
        const msg = payload?.error?.message || payload?.message || `Cloudinary upload failed (${upstream.status})`;
        return res.status(502).json({ error: msg, status: upstream.status });
    }

    const url = String(payload?.secure_url || payload?.url || '').trim();
    const publicId = String(payload?.public_id || '').trim();
    if (!url) return res.status(502).json({ error: 'Cloudinary upload succeeded but no URL returned' });

    return res.status(200).json({ url, publicId });
}
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
const REQUIRED_ENV = ['ADMIN_BACKEND_URL'];

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
    const secretValue = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || '';
    const secret = secretValue ? new TextEncoder().encode(secretValue) : null;
        const pathParam = req.query.path || [];
        const joinedPath = pathParam.join('/');
        // Allow unauthenticated access for explicit public endpoints
        // - admin/login: credential-based login to obtain a JWT (no session yet)
        // - admin/auth/ping: health check
        const isPublic = joinedPath === 'admin/login' || joinedPath === 'admin/auth/ping';

        // Check session/token only for non-public endpoints
        if (!isPublic) {
            // ✅ Accept either cookie np_admin OR Authorization: Bearer <token>
            const authHeader = (req.headers['authorization'] || req.headers['Authorization'] || '').toString();
            const bearer = authHeader.toLowerCase().startsWith('bearer ')
                ? authHeader.slice(7).trim()
                : '';
            const cookies = parseCookies(req.headers.cookie);
            const cookieToken = cookies['np_admin'];
            const tokenToVerify = bearer || cookieToken;
            if (!tokenToVerify) return res.status(401).json({ error: 'Unauthorized' });

            // If a secret is provided AND the token appears to be a JWT (has two dots), verify it.
            // Otherwise, accept presence as a soft session (supports simpler backends that set np_admin cookie).
            const looksJwt = typeof tokenToVerify === 'string' && tokenToVerify.split('.').length === 3;
            if (secret && looksJwt) {
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
        }

        // Special-case: cover image uploads are handled at the proxy (Cloudinary).
        if (joinedPath === 'uploads/cover') {
            return await handleCoverUpload(req, res);
        }
    // Build target URL, avoiding accidental double "/api" when client paths already include it
    const needsApiPrefix = !/^api\//i.test(joinedPath);
    const targetPath = needsApiPrefix ? `api/${joinedPath}` : joinedPath;
    const targetUrl = new URL(`${backendBase}/${targetPath}`);
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
