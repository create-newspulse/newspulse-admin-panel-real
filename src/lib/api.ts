// src/lib/api.ts
import axios, { AxiosError } from "axios";

/**
 * Backend origin:
 * - If VITE_API_URL or VITE_API_BASE is set (e.g. http://localhost:5000), use it.
 * - Otherwise, use same-origin and let Vite proxy /api -> backend in dev.
 */
// Choose the base API origin carefully. Some dev envs set VITE_API_URL to include
// the '/api' path (legacy). Prefer VITE_API_BASE for an origin without '/api'.
const RAW_BASE = String(import.meta.env.VITE_API_BASE ?? import.meta.env.VITE_API_URL ?? "");
let BASE = RAW_BASE.replace(/\/$/, ""); // strip trailing slash
// If the provided value already includes '/api' at the end, remove it so we can
// use a consistent '/api' mount below.
BASE = BASE.replace(/\/api$/i, "");
const baseURL = BASE ? `${BASE}/api` : "/api";

// Single axios instance for all API calls
const apiClient = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 20_000,
});

// Centralized error logging (helps debug 404/500 quickly)
apiClient.interceptors.response.use(
  (r) => r,
  (err: AxiosError<any>) => {
    const status = err.response?.status;
    const data = err.response?.data as any;
    const msg = (data && (data.message || data.error)) || err.message;
    console.error(`API ${status ?? ""}: ${msg}`, data);
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
};

export default apiClient;
