// src/lib/api.ts
import axios, { AxiosError } from "axios";

/**
 * Simplified backend origin resolution per new requirements:
 * Use VITE_API_URL directly. If missing, warn and fallback to '/admin-api'.
 * In development (vite), if VITE_API_URL is absent, fallback to '/api'.
 */
const isDevelopment = import.meta.env.MODE === 'development';
const RAW_ENV_BASE = (import.meta.env.VITE_API_URL || '').toString().trim();
if (!RAW_ENV_BASE) {
  console.warn('⚠️ VITE_API_URL is missing. Falling back to direct backend URL in production.');
}
// Determine fallback path depending on environment
const FALLBACK_BASE = isDevelopment
  ? '/api'
  : 'https://newspulse-backend-real.onrender.com/api';
const RESOLVED_BASE = (RAW_ENV_BASE || FALLBACK_BASE).replace(/\/$/, '');
console.log('🔧 API Base Resolution:', { MODE: import.meta.env.MODE, VITE_API_URL: RAW_ENV_BASE || null, RESOLVED_BASE });

// Single axios instance for all API calls (no auto /api suffix logic now)
const apiClient = axios.create({
  baseURL: RESOLVED_BASE,
  withCredentials: true,
  timeout: 20_000,
});

// Backwards-compatible alias for existing code that still references `baseURL`
// (Some helper paths below were written before the refactor.)
const baseURL = RESOLVED_BASE;

// Debug interceptor to log requests
apiClient.interceptors.request.use((config) => {
  // Normalize accidental double '/api' (e.g., base '/api' + url '/api/x')
  const baseEndsWithApi = (config.baseURL || '').replace(/\/$/, '').endsWith('/api');
  if (baseEndsWithApi && (config.url || '').startsWith('/api/')) {
    config.url = (config.url || '').slice(4); // drop leading '/api'
  }
  console.log('🚀 API Request:', config.method?.toUpperCase(), config.url, 'Full URL:', (config.baseURL || '') + (config.url || ''));
  return config;
});
// Centralized error logging (helps debug 404/500 quickly)
apiClient.interceptors.response.use(
  (r) => r,
  (err: AxiosError<any>) => {
    const status = err.response?.status;
    const data = err.response?.data as any;
    const msg = (data && (data.message || data.error)) || err.message;
    console.error(`API ${status ?? ""}: ${msg}`, data);
    // On unauthorized in production, steer to correct auth page for area
    if (status === 401 && typeof window !== 'undefined' && !isDevelopment) {
      const path = window.location.pathname || '';
      const dest = path.startsWith('/employee') ? '/employee/login' : '/admin/login';
      if (path !== dest) window.location.href = dest;
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

// Export resolved base path for building absolute URLs in anchors/fetch
export const API_BASE_PATH = RESOLVED_BASE;

// ---- Unified Auth API (stubs-compatible) ----
// AxiosResponse type no longer needed after refactor
export type LoginDTO = { email: string; password: string };
export type LoginResp = { token: string; user: { id: string; name: string; email: string; role: 'founder'|'admin'|'employee' } };

export const AuthAPI = {
  // Updated: backend route mounted at /admin/auth/login (proxy adds /api prefix when using /admin-api)
  login: async (body: LoginDTO): Promise<LoginResp> => {
    console.log('🔐 AuthAPI.login -> POST /admin/auth/login', { base: RESOLVED_BASE, body });
    const r = await apiClient.post('/admin/auth/login', body);
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
