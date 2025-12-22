// Single source of truth for backend base URL selection.
//
// Contract (local behaves like Vercel):
// - Callers pass paths WITHOUT the '/api' prefix (e.g. '/articles', '/system/health').
// - apiUrl() prefixes exactly ONE '/api' at send time.
// - Base resolution:
//   - If VITE_ADMIN_API_ORIGIN is set and valid (no placeholders), use '<origin>' (no trailing /api).
//   - Otherwise use proxy base VITE_ADMIN_API_PROXY_BASE (default '/admin-api').
//
// This ensures we never create '/api/api/*' and avoids mixing '/api/*' vs '/admin-api/*' in call sites.
const envAny = import.meta.env as any;

const INVALID_SENTINEL = '/__np_missing_api_base__';
let warnedOnce = false;

function isValidAbsoluteUrl(u: string): boolean {
	if (!/^https?:\/\//i.test(u)) return false;
	try {
		// eslint-disable-next-line no-new
		new URL(u);
		return true;
	} catch {
		return false;
	}
}

function emitApiConfigErrorOnce(message: string) {
	if (warnedOnce) return;
	warnedOnce = true;
	try {
		if (typeof window !== 'undefined') {
			window.dispatchEvent(new CustomEvent('np:api-config-error', { detail: { message } }));
		}
	} catch {
		// ignore
	}
}

function resolveApiBase(): string {
	const proxyBase = (envAny.VITE_ADMIN_API_PROXY_BASE || '/admin-api').toString().trim() || '/admin-api';
	const proxyBaseNorm = proxyBase.startsWith('/') ? proxyBase.replace(/\/+$/, '') : `/${proxyBase.replace(/\/+$/, '')}`;

	const rawOrigin = (
		envAny.VITE_ADMIN_API_ORIGIN ||
		// Back-compat (avoid using in new code):
		envAny.VITE_API_URL ||
		envAny.VITE_API_BASE_URL ||
		envAny.VITE_ADMIN_API_BASE_URL ||
		''
	).toString().trim();
	const trimmed0 = rawOrigin.replace(/\/+$/, '');
	const origin = /\/api$/i.test(trimmed0) ? trimmed0.replace(/\/api$/i, '') : trimmed0;

	const containsPlaceholders = /[<>]/.test(origin) || /(your[_-]?api|example\.com)/i.test(origin);
	const ok = !!origin && !containsPlaceholders && isValidAbsoluteUrl(origin);

	if (ok) return origin;

	// Prefer proxy mode when origin is unset/invalid.
	if (import.meta.env.PROD && origin && !ok) {
		emitApiConfigErrorOnce(
			`Invalid VITE_ADMIN_API_ORIGIN (falling back to proxy). Got: ${origin}`
		);
	}
	return proxyBaseNorm;
}

export const API_BASE = resolveApiBase();

function normalizePath(path: string): string {
	let p = path.startsWith('/') ? path : `/${path}`;
	// Callers must pass paths like '/articles' not '/api/articles'.
	// Tolerate older call sites by stripping a single leading '/api'.
	if (p === '/api') return '/';
	if (p.startsWith('/api/')) p = p.replace(/^\/api\//, '/');
	// Collapse known double-prefix mistakes.
	p = p.replace(/^\/api\/api\//, '/');
	return p;
}

// apiUrl builds a URL given a path WITHOUT the '/api' prefix.
// Examples:
// - apiUrl('/articles') -> '${API_BASE}/articles'
// - apiUrl('system/health') -> '${API_BASE}/system/health'
export function apiUrl(path: string): string {
	const p = normalizePath(path);
	const base = API_BASE.replace(/\/+$/, '');
	// Prefix exactly one '/api'
	const apiPrefix = '/api';
	return `${base}${apiPrefix}${p.startsWith('/') ? p : `/${p}`}`;
}

// Convenience constants
export const HEALTH_URL = apiUrl('/system/health');
export const AI_TRAINING_INFO_URL = apiUrl('/admin/system/ai-training-info');

export default apiUrl;
