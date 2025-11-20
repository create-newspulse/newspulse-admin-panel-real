const API_ORIGIN = (import.meta.env.VITE_API_URL?.toString() || 'https://newspulse-backend-real.onrender.com').replace(/\/+$/, '');
const API_BASE = `${API_ORIGIN}/api`;

export type FetchJsonOptions = RequestInit & {
  timeoutMs?: number;
};

export async function fetchJson<T = any>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const { timeoutMs = 15000, headers, ...rest } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const normalize = (u: string) => {
    if (/^https?:\/\//i.test(u)) return u;
    if (u.startsWith('/api/')) return `${API_ORIGIN}${u}`;
    if (u.startsWith('/')) return `${API_BASE}${u}`; // '/system/x' -> origin/api/system/x
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
      throw new Error(`Unexpected content-type: ${ct || 'unknown'}. Preview: ${txt.slice(0, 200)}`);
    }
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}
