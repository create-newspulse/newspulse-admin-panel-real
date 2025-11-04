import { jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
// 📁 src/components/ProtectedRoute.tsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@context/AuthContext';
export default function ProtectedRoute({ children, role }) {
    const { isAuthenticated, user, isLoading } = useAuth();
    const location = useLocation();
    if (isLoading) {
        return _jsx("div", { className: "text-center mt-10", children: "\uD83D\uDD10 Loading access..." });
    }
    if (!isAuthenticated || !user) {
        return _jsx(Navigate, { to: "/login", state: { from: location }, replace: true });
    }
    if (role && user.role !== role) {
        return _jsx(Navigate, { to: "/unauthorized", state: { from: location }, replace: true });
    }
    return _jsx(_Fragment, { children: children });
}
