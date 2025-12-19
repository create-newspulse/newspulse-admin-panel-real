// Centralized API URL builder for proxy vs direct modes
import { ADMIN_API_BASE, adminApiUrl as adminJoin } from '@/lib/url';
const envAny = import.meta.env as any;
const USE_PROXY = String(envAny.VITE_USE_PROXY || '').toLowerCase() === 'true';
const ORIGIN = ((envAny.VITE_ADMIN_API_ORIGIN || '') as string).replace(/\/+$/, ''); // no /api suffix

// apiUrl builds a full URL given a canonical path that begins with '/api/...'
// - Proxy mode: '/api/x' -> '/admin-api/x' (proxy already rewrites to backend '/api/*')
// - Direct mode: '<origin>/api/x'
export function apiUrl(path: string): string {
	const p = path.startsWith('/') ? path : `/${path}`;
	if (USE_PROXY || !ORIGIN) {
		// Strip '/api/' so we don't generate '/admin-api/api/*' (double '/api').
		return adminJoin(p.replace(/^\/api\//, '/'));
	}
	return `${ORIGIN}${p}`;
}

// Convenience constants
export const HEALTH_URL = apiUrl('/api/system/health');
export const AI_TRAINING_INFO_URL = apiUrl('/api/admin/system/ai-training-info');

export default apiUrl;
