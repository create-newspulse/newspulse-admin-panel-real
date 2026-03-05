import axios from 'axios';

// Admin frontend should always talk to the backend via the Vercel proxy.
// This keeps auth/cookies consistent and avoids CORS surprises.
const API_BASE_URL = '/admin-api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true
});

api.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem('np_token');
    if (token) {
      config.headers = config.headers || {};
      (config.headers as any).Authorization = `Bearer ${token}`;
    }
  } catch {}
  return config;
});
