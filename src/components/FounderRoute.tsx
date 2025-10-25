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

  // 🛡️ SECURE: Only bypass if explicitly enabled via environment variable
  // This prevents accidental security bypasses in real production
  const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';
  const isVercelPreview = window.location.hostname.includes('vercel.app');
  
  // 🔒 SECURITY: Only allow bypass for specific demo environments  
  const allowDemoBypass = isDemoMode && isVercelPreview;
  
  if (isLoading) {
    return <div className="text-center mt-10">🔐 Checking founder access...</div>;
  }

  // ✅ Proper authentication check OR controlled demo access
  if ((isAuthenticated && isFounder) || allowDemoBypass) {
    return <>{children}</>;
  }

  // 🚫 Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // 🚫 Redirect to unauthorized if authenticated but not founder
  return <Navigate to="/unauthorized" replace state={{ from: location }} />;
};

export default FounderRoute;
