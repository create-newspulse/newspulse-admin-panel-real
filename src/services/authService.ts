// 📁 src/services/authService.ts
import axios from 'axios';
import { API_BASE_PATH } from '../lib/api';

// Normalize to centralized API base which guarantees trailing /api in dev/prod
const API = API_BASE_PATH;

export const login = async (email: string, password: string) => {
  return axios.post(`${API}/admin/login`, {
    email,
    password,
  });
};
