// 📁 src/services/authService.ts
import axios from 'axios';

const API = import.meta.env.VITE_API_URL;

export const login = async (email: string, password: string) => {
  return axios.post(`${API}/admin/login`, {
    email,
    password,
  });
};
