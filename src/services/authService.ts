// 📁 src/services/authService.ts
import { adminRoot } from '../lib/adminApi';

export const login = async (email: string, password: string) => {
  return adminRoot.post('/admin/login', { email, password });
};
