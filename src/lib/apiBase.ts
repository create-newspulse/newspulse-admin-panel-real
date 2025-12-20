// Single source of truth for backend base per spec.
// - Production: set VITE_API_BASE_URL to your backend origin (no /api suffix)
// - Local dev: default is http://localhost:5000, but you may set VITE_USE_PROXY=true
//   to use Vite's /api proxy (so requests are made to /api/*).
const envAny = import.meta.env as any;

export const API_BASE = (envAny.VITE_API_BASE_URL || 'http://localhost:5000').toString().trim().replace(/\/+$/, '');
const USE_PROXY = String(envAny.VITE_USE_PROXY || '').toLowerCase() === 'true' && import.meta.env.DEV;

function normalizeApiPath(path: string): string {
	let p = path.startsWith('/') ? path : `/${path}`;
	// Collapse known double-prefix mistakes.
	p = p.replace(/^\/api\/api\//, '/api/');
	if (p === '/api' || p.startsWith('/api/')) return p;
	return `/api${p.replace(/^\/+/, '/')}`;
}

// apiUrl builds a URL given a path that may or may not include '/api'.
// - Proxy mode: returns a relative '/api/..' URL (Vite proxy handles forwarding)
// - Direct mode: returns '${API_BASE}/api/..'
export function apiUrl(path: string): string {
	const p = normalizeApiPath(path);
	if (USE_PROXY) return p;
	return `${API_BASE}${p}`;
}

// Convenience constants
export const HEALTH_URL = apiUrl('/api/system/health');
export const AI_TRAINING_INFO_URL = apiUrl('/api/admin/system/ai-training-info');

export default apiUrl;
