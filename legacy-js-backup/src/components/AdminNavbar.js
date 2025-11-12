import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// ≡ƒôé components/Admin/AdminNavbar.tsx
import { NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
export default function AdminNavbar() {
    const navigate = useNavigate();
    const [confirmLogout, setConfirmLogout] = useState(false);
    const handleLogout = () => {
        const confirm = confirmLogout || window.confirm("Are you sure you want to logout?");
        if (confirm) {
            localStorage.removeItem("adminToken");
            localStorage.removeItem("sessionId");
            // Optional: clear other secure keys here
            navigate("/admin");
        }
        else {
            setConfirmLogout(true);
        }
    };
    const navLinkClass = "text-sm font-medium text-white hover:text-yellow-300 transition";
    const activeLinkClass = "underline underline-offset-4 text-yellow-400 font-semibold";
    return (_jsxs("nav", { className: "bg-gray-900 text-white px-6 py-3 shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between", role: "navigation", "aria-label": "Admin Panel Navigation", children: [_jsx("div", { className: "text-xl font-bold mb-2 sm:mb-0", children: "\uD83D\uDEE1\uFE0F News Pulse Admin" }), _jsxs("div", { className: "flex flex-wrap gap-4 items-center", children: [_jsx(NavLink, { to: "/admin/dashboard", className: ({ isActive }) => isActive ? `${navLinkClass} ${activeLinkClass}` : navLinkClass, children: "\uD83D\uDCCA Dashboard" }), _jsx(NavLink, { to: "/admin/add", className: ({ isActive }) => isActive ? `${navLinkClass} ${activeLinkClass}` : navLinkClass, children: "\u2795 Add News" }), _jsx(NavLink, { to: "/admin/manage", className: ({ isActive }) => isActive ? `${navLinkClass} ${activeLinkClass}` : navLinkClass, children: "\uD83D\uDCC1 Manage News" }), _jsx("button", { onClick: handleLogout, className: "bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-md transition", "aria-label": "Logout from admin", children: "\uD83D\uDD12 Logout" })] })] }));
}
