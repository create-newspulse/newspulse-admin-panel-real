import crypto from 'crypto';
// In-memory throttle bucket (note: ephemeral in serverless)
const BUCKET = new Map();
export function rateLimit(key, max, windowMs) {
    const now = Date.now();
    const arr = BUCKET.get(key) || [];
    const filtered = arr.filter((t) => now - t < windowMs);
    if (filtered.length >= max)
        return false;
    filtered.push(now);
    BUCKET.set(key, filtered);
    return true;
}
export function checkCsrf(req, res) {
    // TODO: integrate real CSRF (SameSite cookies + double submit or Origin/Referrer checks)
    if (req.method !== 'POST')
        return true;
    const mockOn = String(process.env.VITE_USE_MOCK || process.env.USE_MOCK || '').toLowerCase() === 'true';
    const header = req.headers['x-csrf'] || '';
    if (mockOn)
        return true; // bypass in mock
    if (!header) {
        res.status(403).json({ ok: false, error: 'CSRF token missing' });
        return false;
    }
    return true;
}
export function requireReauth(req, res) {
    // TODO: verify fresh password/JWT re-auth
    const mockOn = String(process.env.VITE_USE_MOCK || process.env.USE_MOCK || '').toLowerCase() === 'true';
    const header = req.headers['x-reauth'] || '';
    if (mockOn)
        return true; // bypass in mock
    if (!header) {
        res.status(401).json({ ok: false, error: 'Re-authentication required' });
        return false;
    }
    return true;
}
export function signUrl(path, secret, expiresInSec = 600) {
    const exp = Math.floor(Date.now() / 1000) + expiresInSec;
    const base = `${path}?exp=${exp}`;
    const sig = crypto.createHmac('sha256', secret).update(base).digest('hex');
    return `${base}&sig=${sig}`;
}
