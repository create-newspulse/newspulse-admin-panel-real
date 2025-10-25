/// <reference types="vite/client" />
import axios from "axios";

// Remove trailing slashes from a URL-like string
const stripSlash = (u?: string) => (u ? u.replace(/\/+$/, "") : u);

// Read from Vite env (only VITE_* are exposed)
const FROM_ENV = stripSlash(import.meta.env?.VITE_API_URL);

// Fallback for local dev
const API_BASE = FROM_ENV || "http://localhost:5000";

// Compose final baseURL -> {API_BASE}/api
const api = axios.create({
  baseURL: `${API_BASE}/api`,
  withCredentials: true, // keep cookies/sessions if backend uses them
  headers: {
    Accept: "application/json",
  },
});

// Optional: normalize errors
api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Surface a cleaner message while preserving original error
    const msg =
      err?.response?.data?.message ||
      err?.message ||
      "Network/Server error";
    return Promise.reject(new Error(msg));
  }
);

export default api;
