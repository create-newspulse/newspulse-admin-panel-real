// 📁 src/services/authService.ts
import { adminApi } from '../lib/adminApi';
import { ADMIN_API_BASE } from '../lib/http/adminFetch';

export const login = async (email: string, password: string) => {
  // Per spec: always POST to `${ADMIN_API_BASE}/admin/login`
  return adminApi.post(`${ADMIN_API_BASE}/admin/login`, { email, password });
};
