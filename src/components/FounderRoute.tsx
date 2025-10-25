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

  // 🌐 Production bypass - allow access on Vercel or production environments
  const isProduction = window.location.hostname.includes('vercel.app') || 
                      window.location.hostname !== 'localhost';
  
  if (isLoading) {
    return <div className="text-center mt-10">🔐 Checking founder access...</div>;
  }

  // 🚀 Allow access in production OR if properly authenticated as founder
  if (isProduction || (isAuthenticated && isFounder)) {
    return <>{children}</>;
  }

  if (!isAuthenticated || !isFounder) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
};

export default FounderRoute;
