import { adminRoot } from './adminApi';

// If proxy base '/admin-api' do not append '/api'. For direct host add '/api'.
export const API_BASE = adminRoot.startsWith('/admin-api') ? adminRoot : `${adminRoot}/api`;
export const AI_TRAINING_INFO_URL = `${API_BASE}/system/ai-training-info`;
export default API_BASE;
