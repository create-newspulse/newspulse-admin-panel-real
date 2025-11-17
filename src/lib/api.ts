// src/lib/api.ts
import axios, { AxiosError } from "axios";
import adminApi from './adminApi';

// Unified base resolution
// Preference order:
// 1. VITE_ADMIN_API_BASE_URL (recommended)
// 2. VITE_API_URL (legacy)
// 3. Fallback to localhost for local dev
const isDevelopment = import.meta.env.MODE === 'development';
const RAW_ADMIN = (import.meta.env.VITE_ADMIN_API_BASE_URL || '').trim();
const RAW_LEGACY = (import.meta.env.VITE_API_URL || '').trim();
// Core API root (no trailing slash)
// Prefer new VITE_ADMIN_API_URL (no /api suffix) but remain backward compatible with VITE_ADMIN_API_BASE_URL
const RAW_NEW = (import.meta.env.VITE_ADMIN_API_URL || '').trim();
const API_ROOT = (RAW_NEW || RAW_ADMIN || RAW_LEGACY || (isDevelopment ? 'http://localhost:5000' : 'https://newspulse-backend-real.onrender.com')).replace(/\/$/, '');
// Base path NOW intentionally WITHOUT automatic '/api' suffix. Routes mounted at root (e.g. /admin-auth/session)
const API_BASE_PATH = API_ROOT;
export { API_BASE_PATH, API_ROOT };
console.log('🔧 API Base Resolution (simplified):', { MODE: import.meta.env.MODE, API_BASE_PATH, API_ROOT });

// Single axios instance for all API calls (no auto /api suffix logic now)
const apiClient = axios.create({
  baseURL: API_BASE_PATH,
  withCredentials: true,
  timeout: 20_000,
});

// Backwards-compatible alias for existing code that still references `baseURL`
// (Some helper paths below were written before the refactor.)
const baseURL = API_BASE_PATH;

// Debug interceptor to log requests
apiClient.interceptors.request.use((config) => {
  // If legacy code still passes '/api/xyz', strip leading '/api' because base no longer has it.
  if ((config.url || '').startsWith('/api/')) {
    config.url = (config.url || '').slice(4);
  }
  console.log('🚀 API Request:', config.method?.toUpperCase(), config.url, 'Full URL:', (config.baseURL || '') + (config.url || ''));
  return config;
});
// Centralized error logging (helps debug 404/500 quickly)
// Fallback host for opportunistic retries (update to actual admin backend host)
// This should point to the service exposing /api/admin/* (Render service: newspulse-admin-backend).
export const ADMIN_BACKEND_FALLBACK = 'https://newspulse-backend-real.onrender.com';
const FALLBACK_PATHS = new Set([
  '/dashboard-stats',
  '/stats',
  '/system/ai-training-info',
  '/admin-auth/session',
]);

apiClient.interceptors.response.use(
  (r) => r,
  async (err: AxiosError<any>) => {
    const status = err.response?.status;
    const data = err.response?.data as any;
    const msg = (data && (data.message || data.error)) || err.message;
    const cfg: any = err.config || {};
    const method = (cfg.method || 'get').toString().toLowerCase();
    const reqUrl = (cfg.url || '').toString();
    const base = (cfg.baseURL || '').toString();

    // Helper to normalize path from axios config.url (may already be a path)
    const normalizePath = (u: string) => {
      try {
        if (/^https?:\/\//i.test(u)) {
          const url = new URL(u);
          return url.pathname + (url.search || '');
        }
      } catch {}
      return u.startsWith('/') ? u : `/${u}`;
    };

    // Opportunistic client-side fallback for GETs on critical dashboard/session endpoints
    const path = normalizePath(reqUrl);
    const isCandidate = method === 'get' && base.startsWith('/admin-api') && FALLBACK_PATHS.has(path.replace(/\?.*$/, ''));
    const alreadyRetried = cfg.__retriedFallback === true;

    if (!alreadyRetried && isCandidate && (status === 404 || status === 405)) {
      try {
        const url = `${ADMIN_BACKEND_FALLBACK}${path}`;
        const resp = await axios.get(url, { withCredentials: true, timeout: 20_000 });
        // Return as if axios resolved normally, preserving config
        (resp as any).config = cfg;
        return resp;
      } catch (e) {
        // fall through to normal error flow
      } finally {
        cfg.__retriedFallback = true;
      }
    }

    console.error(`API ${status ?? ''}: ${msg}`, data);
    // On unauthorized in production, steer to correct auth page for area
    if (status === 401 && typeof window !== 'undefined' && !isDevelopment) {
      const pathNow = window.location.pathname || '';
      const dest = pathNow.startsWith('/employee') ? '/employee/login' : '/admin/login';
      if (pathNow !== dest) window.location.href = dest;
    }
    return Promise.reject(err);
  }
);

// Optional: auth header helper
export const setAuthToken = (token?: string) => {
  if (token) apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete apiClient.defaults.headers.common.Authorization;
};

// Typed helpers
const get = async <T>(path: string, params?: Record<string, any>): Promise<T> => {
  const res = await apiClient.get<T>(path, { params });
  return res.data;
};
const post = async <T>(path: string, body?: any): Promise<T> => {
  const res = await apiClient.post<T>(path, body);
  return res.data;
};
const del = async <T>(path: string): Promise<T> => {
  const res = await apiClient.delete<T>(path);
  return res.data;
};

// Public API surface (adjust paths to match your router mounted at `/api`)
export const api = {
  // KPI cards
  stats: () =>
    get<{ totals: { news: number; categories: number; languages: number; users: number }; aiLogs: number }>(
      "/stats"
    ),

  // Weekly AI insights
  weekly: () =>
    get<{ summary: { suggestedStories: number; window: string }; top: { title: string; reads: number; engagement: number } }>(
      "/insights/weekly"
    ),

  // Traffic/reads line chart
  traffic: () =>
    get<{ series: { label: string; visits: number }[] }>("/charts/traffic"),

  // News list
  news: (page = 1, limit = 10) =>
    get<{ items: any[]; total: number }>("/news", { page, limit }),

  // (Optional) System endpoints you’re already using elsewhere
  monitorHub: () => get("/system/monitor-hub"),
  thinkingFeed: () => get("/system/thinking-feed"),
  aiQueue: () => get("/system/ai-queue"),
  diagnostics: () => get("/system/ai-diagnostics"),
  clearLogs: () => del("/system/clear-logs"),
  askKiranOS: (prompt: string) => post<{ reply: string }>("/system/ask-kiranos", { prompt }),

  // SafeZone panels
  systemHealth: () => get("/safezone/system-health"),
  aiActivityLog: () => get("/ai-activity-log"),

  // Polls
  pollsLiveStats: () => get("/polls/live-stats"),
  pollsExportPdfPath: () => `${baseURL}/polls/export-pdf`,

  // Revenue
  revenue: () => get("/revenue"),
  revenueExportPdfPath: () => `${baseURL}/revenue/export/pdf`,

  // AI Engine
  aiEngineRun: async (payload: {
    provider?: 'openai' | 'gemini';
    model?: string;
    language?: string;
    taskType?: string;
    founderCommand?: string;
    sourceText?: string;
    url?: string;
  }): Promise<{ success: boolean; provider: string; model: string | null; result: any; safety: { uniquenessScore: number; note: string } }> => {
    // Call the admin backend path; in dev baseURL=/api via proxy; in prod baseURL is your backend URL + /api
    const r = await fetch(`${baseURL}/ai-engine`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({} as any));
      throw { response: { data: err, status: r.status } };
    }
    return r.json();
  },
};

export default apiClient;

// ---- Unified Auth API (stubs-compatible) ----
// AxiosResponse type no longer needed after refactor
export type LoginDTO = { email: string; password: string };
export type LoginResp = { token: string; user: { id: string; name: string; email: string; role: 'founder'|'admin'|'employee' } };

export const AuthAPI = {
  // Use unified admin API client -> base: /api/admin (dev) or /admin-api/admin (prod)
  // Backend route is POST /api/admin/login (router.post('/login') mounted at /api/admin)
  login: async (body: LoginDTO): Promise<LoginResp> => {
    console.log('🔐 AuthAPI.login -> POST /login', { base: (adminApi.defaults.baseURL || '(unset)') });
    const r = await adminApi.post('/login', body);
    const d: any = r.data || {};
    const token = d.token || d?.data?.token || '';
    const u = d.user || d?.data?.user || {};
    const user = {
      id: String(u.id || u._id || ''),
      name: String(u.name || ''),
      email: String(u.email || ''),
      role: (u.role || 'employee') as LoginResp['user']['role'],
    };
    return { token, user };
  },
  // Keep OTP endpoints as stubs; implement on backend later
  otpRequest: (email: string) => apiClient.post('/auth/password/otp-request', { email }).then(r => r.data),
  otpVerify: (email: string, otp: string) => apiClient.post('/auth/password/otp-verify', { email, otp }).then(r => r.data),
  passwordReset: (email: string, otp: string, newPassword: string) => apiClient.post('/auth/password/reset', { email, otp, newPassword }).then(r => r.data),
};
