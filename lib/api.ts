/// <reference types="vite/client" />
import axios from "axios";

// Remove trailing slashes from a URL-like string
const stripSlash = (u?: string) => (u ? u.replace(/\/+$/, "") : u);

// Read from Vite env (only VITE_* are exposed)
const USE_PROXY = String(import.meta.env?.VITE_USE_PROXY || '').toLowerCase() === 'true';
const ORIGIN = stripSlash(import.meta.env?.VITE_ADMIN_API_ORIGIN);
const RAW_NEW = stripSlash(import.meta.env?.VITE_ADMIN_API_URL);
const RAW_ADMIN = stripSlash(import.meta.env?.VITE_ADMIN_API_BASE_URL);
const RAW_LEGACY = stripSlash(import.meta.env?.VITE_API_URL);
// Prefer explicit origin; fallback to '/admin-api' when proxy is enabled; otherwise use any legacy base.
const API_ROOT = (USE_PROXY ? '/admin-api' : (ORIGIN || RAW_NEW || RAW_ADMIN || RAW_LEGACY || '')) || '/admin-api';
// Compose final baseURL WITHOUT automatic /api suffix now.
const api = axios.create({
  baseURL: `${API_ROOT.replace(/\/$/, '')}`,
  withCredentials: true, // keep cookies/sessions if backend uses them
  headers: {
    Accept: "application/json",
  },
});

// Optional: normalize errors
api.interceptors.request.use((config) => {
  // Strip leading /api from legacy calls
  if ((config.url || '').startsWith('/api/')) {
    config.url = (config.url || '').slice(4);
  }
  return config;
});
api.interceptors.response.use((res) => res, (err) => {
  const msg = err?.response?.data?.message || err?.message || "Network/Server error";
  return Promise.reject(new Error(msg));
});

export default api;
