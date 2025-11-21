import { adminRoot } from './adminApi';

// If using proxy '/admin-api' do NOT append '/api'. For direct hosts, we append '/api'.
const API_ORIGIN = adminRoot;
const API_BASE = API_ORIGIN === '/admin-api' ? API_ORIGIN : `${API_ORIGIN}/api`;

export type FetchJsonOptions = RequestInit & {
  timeoutMs?: number;
};

export async function fetchJson<T = any>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const { timeoutMs = 15000, headers, ...rest } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const normalize = (u: string) => {
    if (/^https?:\/\//i.test(u)) return u;
    if (u.startsWith('/api/')) {
      // Proxy base: strip leading /api so rewrite maps /admin-api/system/health -> backend /api/system/health
      if (API_ORIGIN === '/admin-api') return `${API_ORIGIN}${u.replace(/^\/api\//, '/')}`;
      return `${API_ORIGIN}${u}`;
    }
    if (u.startsWith('/')) {
      return `${API_BASE}${u}`;
    }
    return `${API_BASE}/${u}`;
  };
  try {
    const finalUrl = normalize(url);
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
        throw new Error(msg);
      }
      const txt = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
    }
    if (!/application\/json/i.test(ct)) {
      const txt = await res.text().catch(() => '');
      const advisory = /text\/html/i.test(ct)
        ? 'Likely hitting SPA fallback (HTML) instead of backend. Check VITE_ADMIN_API_BASE_URL or vercel.json rewrite.'
        : 'Unexpected non-JSON response.';
      throw new Error(`Unexpected content-type: ${ct || 'unknown'}. ${advisory} Preview: ${txt.slice(0, 200)}`);
    }
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}
