import axios, { AxiosError } from 'axios';
import { API_BASE_PATH } from './api';

// Centralized Admin Backend client now derives from unified API_BASE_PATH
// Backend mounts admin auth at /api/admin/* so we append '/admin'
export const ADMIN_API_BASE = `${API_BASE_PATH.replace(/\/$/, '')}/admin`;

export const adminApi = axios.create({
  baseURL: ADMIN_API_BASE,
  withCredentials: true,
  timeout: 20000,
});

// Optional: attach token if present
export const attachAdminToken = () => {
  try {
    const t = localStorage.getItem('adminToken');
    if (t) adminApi.defaults.headers.common['Authorization'] = `Bearer ${t}`;
    else delete adminApi.defaults.headers.common['Authorization'];
  } catch {}
};

// Optional: redirect to login on 401 (only if we're not already there)
adminApi.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error?.response?.status === 401 && typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (!/\/admin\/login$/.test(path)) window.location.href = '/admin/login';
    }
    return Promise.reject(error);
  }
);

// ---- Convenience helpers with automatic legacy fallback ----
// Some older deployments may still expose /auth/login or /auth/seed-founder. We try modern path first.
export type AdminLoginDTO = { email: string; password: string };
export type AdminLoginResp = { token: string; user: { id: string; name: string; email: string; role: 'founder' | 'admin' | 'employee' } };

const extractTokenUser = (data: any) => {
  const d = data || {};
  const token = d.token || d?.data?.token || '';
  const u = d.user || d?.data?.user || {};
  const rawRole = String(u.role || 'employee');
  const allowed: string[] = ['founder','admin','employee'];
  const role = allowed.includes(rawRole) ? rawRole : 'employee';
  return {
    token,
    user: {
      id: String(u.id || u._id || ''),
      name: String(u.name || ''),
      email: String(u.email || ''),
      role: role as 'founder' | 'admin' | 'employee',
    },
  };
};

export async function loginAdmin(body: AdminLoginDTO): Promise<AdminLoginResp> {
  try {
    const r = await adminApi.post('/login', body);
    return extractTokenUser(r.data) as AdminLoginResp;
  } catch (err) {
    const e = err as AxiosError & { response?: any };
    const status = e?.response?.status;
    if (status === 404) {
      // fallback to legacy path
      const r2 = await adminApi.post('/auth/login', body);
      return extractTokenUser(r2.data) as AdminLoginResp;
    }
    throw err;
  }
}

export async function seedFounder(params: { email: string; password: string; force?: boolean }): Promise<any> {
  try {
    const r = await adminApi.post('/seed-founder', params);
    return r.data;
  } catch (err) {
    const e = err as AxiosError & { response?: any };
    if (e?.response?.status === 404) {
      const r2 = await adminApi.post('/auth/seed-founder', params);
      return r2.data;
    }
    throw err;
  }
}

export default adminApi;
