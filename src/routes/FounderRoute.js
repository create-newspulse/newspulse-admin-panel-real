import { jsx as _jsx } from "react/jsx-runtime";
// 📁 src/routes/FounderRoute.tsx
import { Navigate } from "react-router-dom";
const FounderRoute = ({ children }) => {
    const user = JSON.parse(localStorage.getItem("adminUser") || "null");
    const isFounder = localStorage.getItem("isFounder") === "true";
    // If there is no user, redirect to login so a preview can show the login screen
    if (!user) {
        return _jsx(Navigate, { to: "/admin/login", replace: true });
    }
    // If user exists but is not a founder, show unauthorized
    if (!user?.role || user.role !== "founder" || !isFounder) {
        return _jsx(Navigate, { to: "/unauthorized", replace: true });
    }
    return children;
};
export default FounderRoute;
