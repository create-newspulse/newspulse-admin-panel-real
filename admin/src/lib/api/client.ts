import axios from 'axios';

const API_BASE_URL =
  (import.meta.env.VITE_API_URL?.toString() || '').replace(/\/+$/, '') ||
  'https://newspulse-backend-real.onrender.com';

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true
});
