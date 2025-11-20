// 📁 src/services/authService.ts
import { adminApi, resolveAdminPath } from '../lib/adminApi';

export const login = async (email: string, password: string) => {
  // Use '/admin/login' when proxy base, '/api/admin/login' when direct host
  const path = resolveAdminPath('/api/admin/login');
  return adminApi.post(path, { email, password });
};
