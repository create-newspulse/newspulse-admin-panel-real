// ✅ src/hooks/useAuthGuard.ts
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
export default function useAuthGuard() {
    const navigate = useNavigate();
    useEffect(() => {
        const token = localStorage.getItem('adminToken');
        if (!token) {
            const p = (typeof window !== 'undefined' ? window.location.pathname : '') || '';
            const dest = p.startsWith('/employee') ? '/employee/login' : '/admin/login';
            navigate(dest, { replace: true });
        }
    }, [navigate]);
}
