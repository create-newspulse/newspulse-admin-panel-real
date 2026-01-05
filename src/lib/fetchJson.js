import { apiUrl } from './apiBase';

export class FetchJsonError extends Error {
    constructor(message) {
        super(message);
        this.name = 'FetchJsonError';
    }
}

function toDisplayPath(maybeUrl) {
    try {
        if (/^https?:\/\//i.test(maybeUrl)) {
            const u = new URL(maybeUrl);
            return u.pathname + u.search;
        }
    }
    catch { }
    return maybeUrl;
}

export async function fetchJson(url, options = {}) {
    const { timeoutMs = 15000, headers, ...rest } = options;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const normalize = (u) => {
        if (/^https?:\/\//i.test(u))
            return u;
        if (u.startsWith('/admin-api/api/'))
            return u;
        if (u.startsWith('/__np_missing_api_base__'))
            return u;
        return apiUrl(u);
    };

    try {
        const finalUrl = normalize(url);
        const method = String(rest?.method || 'GET').toUpperCase();
        const res = await fetch(finalUrl, {
            credentials: 'include',
            headers: { accept: 'application/json', ...(headers || {}) },
            signal: controller.signal,
            ...rest,
        });
        const ct = res.headers.get('content-type') || '';
        if (!res.ok) {
            if (/application\/json/i.test(ct)) {
                const j = await res.json().catch(() => null);
                const msg = (j && (j.error || j.message)) || `${res.status} ${res.statusText}`;
                const err = new FetchJsonError(msg);
                err.status = res.status;
                err.statusText = res.statusText;
                err.url = finalUrl;
                err.method = method;
                err.contentType = ct;
                throw err;
            }
            const txt = await res.text().catch(() => '');
            const err = new FetchJsonError(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
            err.status = res.status;
            err.statusText = res.statusText;
            err.url = finalUrl;
            err.method = method;
            err.contentType = ct;
            err.preview = txt.slice(0, 200);
            throw err;
        }
        if (!/application\/json/i.test(ct)) {
            const txt = await res.text().catch(() => '');
            const advisory = /text\/html/i.test(ct)
                ? 'Likely hitting SPA fallback (HTML) instead of backend. Check VITE_API_URL or vercel.json rewrite.'
                : 'Unexpected non-JSON response.';
            const err = new FetchJsonError(`Unexpected content-type: ${ct || 'unknown'}. ${advisory} Preview: ${txt.slice(0, 200)}`);
            err.status = res.status;
            err.statusText = res.statusText;
            err.url = finalUrl;
            err.method = method;
            err.contentType = ct;
            err.preview = txt.slice(0, 200);
            throw err;
        }
        return res.json();
    }
    catch (e) {
        if (e?.name === 'AbortError') {
            const err = new FetchJsonError(`Request timed out after ${timeoutMs}ms`);
            err.url = toDisplayPath(typeof url === 'string' ? url : String(url));
            err.method = String(rest?.method || 'GET').toUpperCase();
            throw err;
        }
        throw e;
    }
    finally {
        clearTimeout(timer);
    }
}
