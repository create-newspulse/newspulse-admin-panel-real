// Back-compat wrapper for older imports.
// This module now derives everything strictly from import.meta.env.VITE_API_URL,
// via the unified client in src/lib/api.ts.

import { apiUrl as _apiUrl, getApiBase } from './api';

export const API_BASE = getApiBase();

// apiUrl builds a URL under `${VITE_API_URL}/api/*`.
// Callers should pass paths WITHOUT the '/api' prefix (e.g. '/system/health').
export function apiUrl(path: string): string {
	return _apiUrl(path);
}

export const HEALTH_URL = apiUrl('/system/health');
export const AI_TRAINING_INFO_URL = apiUrl('/admin/system/ai-training-info');

export default apiUrl;
