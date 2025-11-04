import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
const AuthenticatedLayout = ({ children, requiredRoles }) => {
    const { user, isAuthenticated, isLoading, logout } = useAuth();
    const navigate = useNavigate();
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    useEffect(() => {
        if (isLoading)
            return;
        if (!isAuthenticated) {
            navigate('/login', { replace: true });
            return;
        }
        if (requiredRoles && user && !requiredRoles.includes(user.role)) {
            navigate('/unauthorized', { replace: true });
        }
    }, [isLoading, isAuthenticated, user, requiredRoles, navigate]);
    const toggleSidebar = useCallback(() => {
        setMobileSidebarOpen((prev) => !prev);
    }, []);
    if (isLoading) {
        return (_jsx("div", { className: "flex justify-center items-center min-h-screen bg-gray-100 dark:bg-gray-900", children: _jsx("p", { className: "text-gray-600 dark:text-gray-300 text-lg", children: "Checking access and loading..." }) }));
    }
    if (!isAuthenticated || (requiredRoles && user && !requiredRoles.includes(user.role))) {
        return null;
    }
    return (_jsxs("div", { className: "min-h-screen flex bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white", children: [_jsx("button", { className: "md:hidden fixed top-4 left-4 z-50 bg-blue-600 text-white p-3 rounded-full shadow-lg transition-transform hover:scale-105", onClick: toggleSidebar, "aria-label": "Toggle Sidebar", children: "\u2630" }), mobileSidebarOpen && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden", onClick: toggleSidebar })), _jsxs("aside", { className: `fixed top-0 left-0 h-full w-60 bg-white dark:bg-gray-800 shadow-lg p-4 z-40 transition-transform duration-300 ease-in-out
        ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:block`, children: [_jsxs("div", { className: "flex justify-between items-center mb-6 md:hidden", children: [_jsx("h2", { className: "text-xl font-bold text-blue-700", children: "Menu" }), _jsx("button", { onClick: toggleSidebar, className: "text-red-500 hover:text-red-700 text-2xl", children: "\u2716" })] }), _jsxs("nav", { className: "space-y-4", children: [_jsx(Link, { to: "/admin-dashboard", className: "block text-base p-2 rounded-md hover:bg-blue-100 dark:hover:bg-gray-700 transition", children: "\uD83C\uDFE0 Dashboard" }), _jsx(Link, { to: "/admin-ai-logs", className: "block text-base p-2 rounded-md hover:bg-blue-100 dark:hover:bg-gray-700 transition", children: "\uD83D\uDCC4 AI Logs" }), _jsx(Link, { to: "/admin-settings", className: "block text-base p-2 rounded-md hover:bg-blue-100 dark:hover:bg-gray-700 transition", children: "\u2699\uFE0F Settings" }), _jsx("button", { onClick: logout, className: "w-full text-left text-base text-red-600 hover:bg-red-100 dark:hover:bg-red-800 p-2 rounded-md transition mt-6", children: "\u27A1\uFE0F Logout" })] })] }), _jsxs("div", { className: "flex-1 md:ml-60 flex flex-col", children: [_jsxs("header", { className: "bg-white dark:bg-gray-800 shadow px-6 py-4 flex justify-between items-center", children: [_jsx("h1", { className: "text-xl font-bold text-blue-600", children: "NewsPulse Admin" }), user && (_jsxs("div", { className: "text-sm", children: ["Welcome, ", _jsx("span", { className: "font-semibold", children: user.email }), ' ', "(", _jsx("span", { className: "capitalize", children: user.role }), ")"] }))] }), _jsx("main", { className: "flex-1 px-4 py-6 max-w-7xl mx-auto w-full", children: children }), _jsxs("footer", { className: "text-center py-4 text-xs text-gray-400 border-t border-gray-200 dark:border-gray-700 mt-auto", children: ["\u00A9 ", new Date().getFullYear(), " NewsPulse. All rights reserved."] })] })] }));
};
export default AuthenticatedLayout;
