import axios from 'axios';

const API_BASE_URL =
    (import.meta.env.VITE_API_URL?.toString() || '').replace(/\/+$/, '') ||
    'https://newspulse-backend-real.onrender.com';

const api = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('adminToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

api.interceptors.response.use((res) => res, (err) => {
    if (err.response && (err.response.status === 401 || err.response.status === 403)) {
        localStorage.removeItem('adminToken');
        window.location.href = '/admin/login';
    }
    return Promise.reject(err);
});

export default api;
