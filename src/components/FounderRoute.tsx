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

  if (isLoading) {
    return <div className="text-center mt-10">🔐 Checking founder access...</div>;
  }

  if (!isAuthenticated || !isFounder) {
    return <Navigate to="/unauthorized" replace state={{ from: location }} />;
  }

  return <>{children}</>;
};

export default FounderRoute;
