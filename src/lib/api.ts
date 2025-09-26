// src/lib/api.ts
import axios from "axios";

// Use environment variable if available, else default to localhost
const baseURL =
  import.meta.env.VITE_API_BASE?.trim() || "http://localhost:5000";

const api = axios.create({
  baseURL: baseURL + "/api",
});

// Optional: helper to set/remove auth token
export const setAuthToken = (token?: string) => {
  if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete api.defaults.headers.common.Authorization;
};

export default api;
