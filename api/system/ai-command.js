// Serverless health endpoint for the Admin Dashboard's AI Command Debug box.
// Now proxies live backend health to guarantee JSON and real-time status.
export default async function handler(req, res) {
    res.setHeader('content-type', 'application/json; charset=utf-8');
    // Only GET is supported here; other actions should go to backend /system/ai-command
    if (req.method !== 'GET') {
        return res.status(405).json({
            success: false,
            error: 'Method not allowed on serverless endpoint. Use backend /system/ai-command for actions.'
        });
    }
    const base = (process.env.ADMIN_BACKEND_URL || '').replace(/\/$/, '');
    // If backend base is not configured, return a static but valid JSON payload
    if (!base) {
        return res.status(200).json({
            success: true,
            proxied: false,
            message: '🟢 Serverless health OK, but ADMIN_BACKEND_URL not set. Returning static status.',
            note: 'Configure ADMIN_BACKEND_URL to proxy real backend health (e.g., https://your-backend.onrender.com)'
        });
    }
    const candidates = [
        `${base}/api/system/health`,
        `${base}/api/health`,
    ];
    // Small helper to fetch with timeout and safe JSON parsing
    const fetchWithTimeout = async (url, timeoutMs = 4000) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const headers = { 'accept': 'application/json' };
            // Forward cookies if present (in case health requires auth)
            if (req.headers.cookie)
                headers['cookie'] = req.headers.cookie;
            const started = Date.now();
            const resp = await fetch(url, { method: 'GET', headers, signal: controller.signal });
            const ms = Date.now() - started;
            const ct = resp.headers.get('content-type') || '';
            let body = null;
            if (/application\/json/i.test(ct)) {
                body = await resp.json().catch(() => ({ nonJson: true, text: '<invalid json>' }));
            }
            else {
                const text = await resp.text().catch(() => '');
                body = { nonJson: true, text };
            }
            return { ok: resp.ok, status: resp.status, url, ms, contentType: ct, body };
        }
        finally {
            clearTimeout(id);
        }
    };
    // Try candidates in order; first successful response wins
    for (const url of candidates) {
        try {
            const r = await fetchWithTimeout(url);
            if (r.ok) {
                return res.status(200).json({
                    success: true,
                    proxied: true,
                    target: r.url,
                    status: r.status,
                    latencyMs: r.ms,
                    contentType: r.contentType,
                    backend: r.body,
                    ts: new Date().toISOString(),
                });
            }
            // Not ok but responded — return the response to aid debugging
            return res.status(r.status || 502).json({
                success: false,
                proxied: true,
                target: r.url,
                status: r.status,
                latencyMs: r.ms,
                contentType: r.contentType,
                backend: r.body,
                ts: new Date().toISOString(),
            });
        }
        catch (err) {
            // Continue to next candidate
        }
    }
    // If all candidates failed (timeouts or network errors)
    return res.status(502).json({
        success: false,
        proxied: true,
        error: 'Failed to reach backend health endpoints',
        tried: candidates,
        ts: new Date().toISOString(),
    });
}
