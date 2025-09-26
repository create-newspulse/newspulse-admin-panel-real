import axios from 'axios';

// Use '/api' as the base for all frontend API calls during development
// Only use VITE_API_URL in production builds or if you deploy the backend separately
const baseURL =
  import.meta.env.MODE === 'development'
    ? '/api'
    : (import.meta.env.VITE_API_URL || '/api'); // fallback to '/api' for SSR/static

const api = axios.create({
  baseURL,
  // If you use cookies for auth, also add: withCredentials: true
});

// 🔐 Attach JWT token from localStorage to every request (if present)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// (Optional) Global error handling: redirect if unauthorized
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      // Remove token, redirect to login page if needed
      localStorage.removeItem('adminToken');
      window.location.href = '/admin/login';
    }
    return Promise.reject(error);
  }
);

export default api;
