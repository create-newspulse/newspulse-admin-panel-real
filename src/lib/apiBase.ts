import { adminRoot } from './adminApi';

// Compute base used for most REST endpoints.
// For rewrite mode ('/admin-api') we use that literal; for direct origin append '/api'.
export const API_BASE = adminRoot === '/admin-api' ? '/admin-api' : `${adminRoot}/api`;
export const HEALTH_URL = `${API_BASE}/system/health`;
export const AI_TRAINING_INFO_URL = `${API_BASE}/system/ai-training-info`;
export default API_BASE;
