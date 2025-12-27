// ✅ src/hooks/useAuthGuard.ts
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function useAuthGuard() {
  const navigate = useNavigate();

  useEffect(() => {
    const p = (typeof window !== 'undefined' ? window.location.pathname : '') || '';
    // Never redirect while on login routes.
    if (p === '/login' || p === '/admin/login' || p === '/employee/login') return;

    // Per spec: only protect /admin/* routes.
    if (!p.startsWith('/admin') && !p.startsWith('/employee')) return;

    const token = localStorage.getItem('np_token') || localStorage.getItem('adminToken');
    if (!token) {
      const dest = p.startsWith('/employee') ? '/employee/login' : '/login';
      navigate(dest, { replace: true });
    }
  }, [navigate]);
}
