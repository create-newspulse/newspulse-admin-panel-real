import { adminRoot } from './adminApi';

// Compute base used for most REST endpoints (direct backend origin).
// Always append '/api' to the direct origin unless it already ends with '/api'.
export const API_BASE = /\/api$/.test(adminRoot) ? adminRoot : `${adminRoot}/api`;
export const HEALTH_URL = `${API_BASE}/system/health`;
export const AI_TRAINING_INFO_URL = `${API_BASE}/system/ai-training-info`;
export default API_BASE;
