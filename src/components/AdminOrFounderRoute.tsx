// 📁 src/components/AdminOrFounderRoute.tsx

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@context/AuthContext';

interface Props {
  children: React.ReactNode;
}

const AdminOrFounderRoute: React.FC<Props> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="text-center mt-10">🔐 Checking access…</div>;
  }

  if (!isAuthenticated || !user) {
    // ✅ Fix: redirect to correct login based on current area
    const p = location.pathname || '';
    const dest = p.startsWith('/employee') ? '/employee/login' : '/admin/login';
    return <Navigate to={dest} state={{ from: location }} replace />;
  }

  const role = (user.role || '').toLowerCase();
  if (!(role === 'admin' || role === 'founder')) {
    return <Navigate to="/unauthorized" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default AdminOrFounderRoute;
