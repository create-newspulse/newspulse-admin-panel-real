import { jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@context/AuthContext';
const FounderRoute = ({ children }) => {
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
        return _jsx("div", { className: "text-center mt-10", children: "\uD83D\uDD10 Checking founder access..." });
    }
    // ✅ Proper authentication check OR controlled demo access
    if ((isAuthenticated && isFounder) || isDemoMode) {
        return _jsx(_Fragment, { children: children });
    }
    // 🚫 Redirect to admin login if not authenticated
    if (!isAuthenticated) {
        return _jsx(Navigate, { to: "/admin/login", replace: true, state: { from: location } });
    }
    // 🚫 Redirect to unauthorized if authenticated but not founder
    return _jsx(Navigate, { to: "/unauthorized", replace: true, state: { from: location } });
};
export default FounderRoute;
