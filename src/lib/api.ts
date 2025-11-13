// src/lib/api.ts
import axios, { AxiosError } from "axios";

/**
 * Backend origin:
 * - In development: use "/api" to let Vite proxy handle requests
 * - In production: use VITE_API_URL with /api appended
 */
const isDevelopment = import.meta.env.MODE === 'development';
const RAW_BASE = (import.meta.env.VITE_API_URL ?? import.meta.env.VITE_API_BASE ?? "") + "";
const BASE = RAW_BASE.replace(/\/$/, ""); // strip trailing slash
// Detect if env points to our proxy path directly
const isProxyPath = BASE.startsWith('/admin-api');
// In production:
//  - if BASE is a proxy path (/admin-api), use it as-is
//  - if BASE is a full origin, append /api
//  - otherwise, default to /admin-api
const baseURL = isDevelopment
  ? "/api"
  : (BASE ? (isProxyPath ? BASE : `${BASE}/api`) : "/admin-api");

console.log('🔧 API Config:', { isDevelopment, RAW_BASE, BASE, baseURL });
// Single axios instance for all API calls
const apiClient = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 20_000,
});

// Debug interceptor to log requests
apiClient.interceptors.request.use((config) => {
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
export const API_BASE_PATH = baseURL;

// ---- Unified Auth API (stubs-compatible) ----
// AxiosResponse type no longer needed after refactor
export type LoginDTO = { email: string; password: string };
export type LoginResp = { token: string; user: { id: string; name: string; email: string; role: 'founder'|'admin'|'employee' } };

export const AuthAPI = {
  // Map to backend alias mounted at /api/admin/login
  login: async (body: LoginDTO): Promise<LoginResp> => {
    const r = await apiClient.post('/admin/login', body);
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
