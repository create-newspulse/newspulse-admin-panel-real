// src/utils/apiFetch.ts
import { API_BASE_PATH } from '@lib/api';
function resolveUrl(url) {
    // Route backend system calls through the authenticated proxy in production
    if (url.startsWith('/api/system')) {
        return `${API_BASE_PATH}${url.slice(4)}`; // '/api/system/x' -> `${API_BASE_PATH}/system/x`
    }
    return url; // keep other serverless endpoints (e.g., /api/ai-engine) untouched
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
