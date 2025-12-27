// 📁 src/components/FounderRoute.tsx

import React, { useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@context/AuthContext';

type FounderRouteProps = {
  children: React.ReactNode;
};

const FounderRoute: React.FC<FounderRouteProps> = ({ children }) => {
  const location = useLocation();
  const { user, isFounder, isAuthenticated, isLoading, isReady, isRestoring, restoreSession } = useAuth();
  const triedRestore = useRef(false);
  const requestedRoleRestoreRef = useRef(false);

  // Per spec: only protect /admin/* routes.
  const isAdminArea = (location.pathname || '').startsWith('/admin');

  // 🛡️ SECURE: Environment-controlled demo access
  const demoModeEnv = import.meta.env.VITE_DEMO_MODE;
  const isVercelPreview = window.location.hostname.includes('vercel.app');
  // 🔧 Local development helper: allow authenticated users through founder gates
  // Enable by setting VITE_DEV_LOOSEN_FOUNDER_ROUTES=true in .env.local
  const devLoosenEnv = (import.meta.env as any).VITE_DEV_LOOSEN_FOUNDER_ROUTES;
  const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const allowDevLoosen = String(devLoosenEnv).toLowerCase() === 'true' && isLocalhost;
  
  // 🔒 SECURITY: Demo mode logic
  // - If VITE_DEMO_MODE is explicitly 'false', require authentication
  // - If VITE_DEMO_MODE is 'true' OR undefined on Vercel, allow demo access
  // - For localhost, always require proper authentication
  const isDemoMode = demoModeEnv !== 'false' && isVercelPreview;
  
  // Debug logging (remove in production)
  if (import.meta.env.DEV) {
    console.debug('[FounderRoute]', {
      demoModeEnv,
      isVercelPreview,
      isDemoMode,
      isAuthenticated,
      isFounder,
      isReady,
      isRestoring,
      hostname: window.location.hostname
    });
  }

  // Attempt session restore after hydration if not authenticated
  useEffect(() => {
    if (!isAdminArea) return;
    if (isReady && !isAuthenticated && !triedRestore.current) {
      triedRestore.current = true;
      restoreSession();
    }
  }, [isAdminArea, isReady, isAuthenticated, restoreSession]);

  // If we have a token/session but are missing role info, restore once before deciding.
  useEffect(() => {
    if (!isAdminArea) return;
    if (!isReady || isRestoring || isLoading) return;
    const missingRole = isAuthenticated && (!user || !user.role);
    if (missingRole && !requestedRoleRestoreRef.current) {
      requestedRoleRestoreRef.current = true;
      restoreSession();
    }
  }, [isAdminArea, isReady, isRestoring, isLoading, isAuthenticated, user, restoreSession]);

  if (!isAdminArea) {
    return <>{children}</>;
  }
  
  if (!isReady || isRestoring) {
    return <div className="text-center mt-10">🔐 Restoring session…</div>;
  }
  if (isLoading) {
    return <div className="text-center mt-10">🔐 Checking founder access…</div>;
  }

  // Don't redirect while we are still trying to fetch role/profile.
  if (isAuthenticated && (!user || !user.role)) {
    if (requestedRoleRestoreRef.current) {
      return <Navigate to="/login" replace state={{ from: location }} />;
    }
    return <div className="text-center mt-10">🔐 Loading profile…</div>;
  }

  // ✅ Proper authentication check OR controlled demo access
  if ((isAuthenticated && isFounder) || isDemoMode || (allowDevLoosen && isAuthenticated)) {
    return <>{children}</>;
  }

  // 🚫 Redirect to admin login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // 🚫 Redirect to unauthorized if authenticated but not founder
  return <Navigate to="/unauthorized" replace state={{ from: location }} />;
};

export default FounderRoute;
