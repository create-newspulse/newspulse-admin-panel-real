// src/utils/apiFetch.ts
const API_ORIGIN = (import.meta.env.VITE_API_URL?.toString() || 'https://newspulse-backend-real.onrender.com').replace(/\/+$/, '');
const API_BASE = `${API_ORIGIN}/api`;
function resolveUrl(url) {
    if (/^https?:\/\//i.test(url)) return url;
    if (url.startsWith('/api/')) return `${API_ORIGIN}${url}`;
    if (url.startsWith('/')) return `${API_BASE}${url}`;
    return `${API_BASE}/${url}`;
}
export async function apiFetch(url, options = {}) {
    const finalUrl = resolveUrl(url);
    const res = await fetch(finalUrl, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        ...options,
    });
    let data;
    try {
        data = await res.json();
    }
    catch {
        const txt = await res.text().catch(() => '');
        throw new Error(`Invalid server response. Body: ${txt.slice(0, 200)}`);
    }
    if (!res.ok)
        throw new Error(data?.message || 'Unknown error');
    return data;
}
