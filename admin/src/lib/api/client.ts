import axios from 'axios';

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL?.toString() || import.meta.env.VITE_API_URL?.toString() || '').replace(/\/+$/, '');

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
