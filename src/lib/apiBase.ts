// Centralized API base and critical endpoint constants
// Decides backend root by build mode only (explicit, no trailing slash)
// Production: Render deployment; Development: local backend.

const API_BASE = import.meta.env.PROD
  ? 'https://newspulse-backend-real.onrender.com'
  : 'http://localhost:5000';

export const ADMIN_LOGIN_URL = `${API_BASE}/admin/login`;
export const ADMIN_SESSION_URL = `${API_BASE}/admin-auth/session`;
export const AI_TRAINING_INFO_URL = `${API_BASE}/system/ai-training-info`;
export const SYSTEM_HEALTH_URL = `${API_BASE}/system/health`;

export { API_BASE };
