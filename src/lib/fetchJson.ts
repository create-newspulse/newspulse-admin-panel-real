import { API_BASE_PATH } from '@lib/api';

export type FetchJsonOptions = RequestInit & {
  timeoutMs?: number;
};

export async function fetchJson<T = any>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const { timeoutMs = 15000, headers, ...rest } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const doFetch = (u: string) => fetch(u, {
      credentials: 'include',
      headers: { 'accept': 'application/json', ...(headers || {}) },
      signal: controller.signal,
      ...rest,
    });

    // First try the provided URL
    let res = await doFetch(url);
    let ct = res.headers.get('content-type') || '';

    // If proxied through /admin-api and the response is 404/405 or HTML, retry against Render admin-backend
  const ADMIN_BACKEND_FALLBACK = 'https://newspulse-backend-real.onrender.com/api';
  const isAdminApiProxy = url.startsWith(API_BASE_PATH) && API_BASE_PATH.startsWith('/admin-api');
    const shouldFallback = isAdminApiProxy && (!res.ok || !/application\/json/i.test(ct));

    if (shouldFallback) {
      // Build path suffix from the requested URL relative to API_BASE_PATH
      let suffix = url.startsWith(API_BASE_PATH) ? url.slice(API_BASE_PATH.length) : '';
      if (!suffix.startsWith('/')) suffix = `/${suffix}`;
      try {
        const fallbackUrl = `${ADMIN_BACKEND_FALLBACK}${suffix}`;
        res = await doFetch(fallbackUrl);
        ct = res.headers.get('content-type') || '';
      } catch {
        // ignore; will be handled below
      }
    }

    if (!res.ok) {
      if (/application\/json/i.test(ct)) {
        const j = await res.json().catch(() => null);
        const msg = (j && (j.error || j.message)) || `${res.status} ${res.statusText}`;
        throw new Error(msg);
      } else {
        const txt = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
      }
    }
    if (!/application\/json/i.test(ct)) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Unexpected content-type: ${ct || 'unknown'}. Preview: ${txt.slice(0, 200)}`);
    }
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}
