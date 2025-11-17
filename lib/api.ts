/// <reference types="vite/client" />
import axios from "axios";

// Remove trailing slashes from a URL-like string
const stripSlash = (u?: string) => (u ? u.replace(/\/+$/, "") : u);

// Read from Vite env (only VITE_* are exposed)
const RAW_NEW = stripSlash(import.meta.env?.VITE_ADMIN_API_URL);
const RAW_ADMIN = stripSlash(import.meta.env?.VITE_ADMIN_API_BASE_URL);
const RAW_LEGACY = stripSlash(import.meta.env?.VITE_API_URL);
const API_ROOT = RAW_NEW || RAW_ADMIN || RAW_LEGACY || (import.meta.env.MODE === 'development' ? 'http://localhost:5000' : 'https://newspulse-backend-real.onrender.com');
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
