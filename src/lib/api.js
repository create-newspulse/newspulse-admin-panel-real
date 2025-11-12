// src/lib/api.ts
import axios from "axios";
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
apiClient.interceptors.response.use((r) => r, (err) => {
    const status = err.response?.status;
    const data = err.response?.data;
    const msg = (data && (data.message || data.error)) || err.message;
    console.error(`API ${status ?? ""}: ${msg}`, data);
    // On unauthorized in production, steer to auth page
        if (status === 401 && typeof window !== 'undefined' && !isDevelopment) {
            // ✅ Fixed: standardize to /login to avoid loops with /auth<->/login.
            const path = window.location.pathname;
            if (path !== '/login') {
                window.location.href = '/login';
            }
        }
    return Promise.reject(err);
});
// Optional: auth header helper
export const setAuthToken = (token) => {
    if (token)
        apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
    else
        delete apiClient.defaults.headers.common.Authorization;
};
// Typed helpers
const get = async (path, params) => {
    const res = await apiClient.get(path, { params });
    return res.data;
};
const post = async (path, body) => {
    const res = await apiClient.post(path, body);
    return res.data;
};
const del = async (path) => {
    const res = await apiClient.delete(path);
    return res.data;
};
// Public API surface (adjust paths to match your router mounted at `/api`)
export const api = {
    // KPI cards
    stats: () => get("/stats"),
    // Weekly AI insights
    weekly: () => get("/insights/weekly"),
    // Traffic/reads line chart
    traffic: () => get("/charts/traffic"),
    // News list
    news: (page = 1, limit = 10) => get("/news", { page, limit }),
    // (Optional) System endpoints you’re already using elsewhere
    monitorHub: () => get("/system/monitor-hub"),
    thinkingFeed: () => get("/system/thinking-feed"),
    aiQueue: () => get("/system/ai-queue"),
    diagnostics: () => get("/system/ai-diagnostics"),
    clearLogs: () => del("/system/clear-logs"),
    askKiranOS: (prompt) => post("/system/ask-kiranos", { prompt }),
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
    aiEngineRun: async (payload) => {
        // Call the admin backend path; in dev baseURL=/api via proxy; in prod baseURL is your backend URL + /api
        const r = await fetch(`${baseURL}/ai-engine`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload),
        });
        if (!r.ok) {
            const err = await r.json().catch(() => ({}));
            throw { response: { data: err, status: r.status } };
        }
        return r.json();
    },
};
export default apiClient;
// Export resolved base path for building absolute URLs in anchors/fetch
export const API_BASE_PATH = baseURL;
