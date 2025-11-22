import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';

interface Props { children: React.ReactElement; }

export default function AdminProtectedRoute({ children }: Props){
  const { auth, isReady } = useAdminAuth();
  const location = useLocation();

  if (!isReady) return <div className="p-4 text-center">🔐 Checking admin session…</div>;
  if (!auth.token) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }
  return children;
}
