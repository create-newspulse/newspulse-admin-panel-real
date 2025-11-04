// 📁 src/components/FounderRoute.tsx

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@context/AuthContext';

type FounderRouteProps = {
  children: React.ReactNode;
};

const FounderRoute: React.FC<FounderRouteProps> = ({ children }) => {
  const location = useLocation();
  const { isFounder, isAuthenticated, isLoading } = useAuth();

  // 🛡️ SECURE: Environment-controlled demo access
  const demoModeEnv = import.meta.env.VITE_DEMO_MODE;
  const isVercelPreview = window.location.hostname.includes('vercel.app');
  
  // 🔒 SECURITY: Demo mode logic
  // - If VITE_DEMO_MODE is explicitly 'false', require authentication
  // - If VITE_DEMO_MODE is 'true' OR undefined on Vercel, allow demo access
  // - For localhost, always require proper authentication
  const isDemoMode = demoModeEnv !== 'false' && isVercelPreview;
  
  // Debug logging (remove in production)
  console.log('🔧 FounderRoute Debug:', {
    demoModeEnv,
    isVercelPreview,
    isDemoMode,
    isAuthenticated,
    isFounder,
    hostname: window.location.hostname
  });
  
  if (isLoading) {
    return <div className="text-center mt-10">🔐 Checking founder access...</div>;
  }

  // ✅ Proper authentication check OR controlled demo access
  if ((isAuthenticated && isFounder) || isDemoMode) {
    return <>{children}</>;
  }

  // 🚫 Redirect to admin login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  // 🚫 Redirect to unauthorized if authenticated but not founder
  return <Navigate to="/unauthorized" replace state={{ from: location }} />;
};

export default FounderRoute;
