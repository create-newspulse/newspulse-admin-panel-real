const API_ORIGIN = (import.meta.env.VITE_API_URL?.toString() || '').replace(/\/+$/, '');
export const API_BASE = API_ORIGIN ? `${API_ORIGIN}/api` : '/api';
