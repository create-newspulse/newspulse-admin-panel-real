// 📁 src/services/authService.ts
import { adminApi } from '../lib/adminApi';

export const login = async (email, password) => {
    return adminApi.post('/login', {
        email,
        password,
    });
};
