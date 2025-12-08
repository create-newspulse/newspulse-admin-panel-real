// Unified API base with prod safety (no localhost fallback in prod)
const __rawBase =
	(import.meta.env as any).VITE_ADMIN_API_URL ||
	(import.meta.env as any).VITE_API_URL ||
	((import.meta.env as any).DEV ? 'http://localhost:10000' : '');

if (!__rawBase) {
	try { console.error('[apiBase] Missing VITE_ADMIN_API_URL in production build'); } catch {}
	throw new Error('Missing admin API base URL');
}

export const API_BASE = __rawBase.toString().replace(/\/+$/, '');

export const HEALTH_URL = `${API_BASE}/api/system/health`;
export const AI_TRAINING_INFO_URL = `${API_BASE}/system/ai-training-info`;
export default API_BASE;
