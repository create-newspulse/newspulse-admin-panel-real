const API_ORIGIN = (import.meta.env.VITE_API_URL?.toString() || 'https://newspulse-backend-real.onrender.com').replace(/\/+$/, '');
export const API_BASE = `${API_ORIGIN}/api`;
export const AI_TRAINING_INFO_URL = `${API_BASE}/system/ai-training-info`;
export default API_BASE;
