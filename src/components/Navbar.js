import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useDarkMode } from '../context/DarkModeContext';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext'; // ✅ Auth context
import LanguageDropdown from './LanguageDropdown';
export default function Navbar() {
    const { isDark, toggleDark } = useDarkMode();
    const { isAuthenticated, isFounder, logout } = useAuth(); // ✅ Auth state
    const navigate = useNavigate();
    const { t } = useTranslation();
    const location = useLocation();
    const handleLogout = () => {
        logout();
        navigate('/auth');
    };
    const navItems = [
        { to: '/', icon: '📊', label: t('dashboard') },
        { to: '/add', icon: '📰', label: t('addNews') },
        { to: '/manage-news', icon: '🗂️', label: t('manage') },
        { to: '/push-history', icon: '📣', label: t('pushHistory') },
        { to: '/media/inspiration', icon: '🌟', label: t('inspirationHub') },
        { to: '/admin/ai-engine', icon: '🧠', label: 'AI Engine' },
        { to: '/admin/media-library', icon: '🖼️', label: 'Media Library' },
        { to: '/admin/ai-assistant', icon: '🤖', label: 'AI Assistant' },
        { to: '/admin/workflow', icon: '🧭', label: 'Workflow' },
        { to: '/admin/analytics', icon: '📈', label: 'Analytics' },
        { to: '/admin/web-stories', icon: '📱', label: 'Web Stories' },
        { to: '/admin/moderation', icon: '💬', label: 'Moderation' },
        { to: '/admin/seo', icon: '🔍', label: 'SEO Tools' },
        { to: '/admin/youth-pulse', icon: '⚡', label: 'Youth Pulse' },
        { to: '/admin/editorial', icon: '📝', label: 'Editorial' },
        { to: '/admin/aira', icon: '🗣️', label: 'AIRA' },
        { to: '/safe-owner', icon: '🛡️', label: t('safeOwnerZone') },
    ];
    return (_jsx("header", { className: "bg-slate-900 text-white px-6 py-4 shadow-md border-b border-slate-700", children: _jsxs("div", { className: "max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4", children: [_jsxs(Link, { to: "/", className: "flex items-center text-blue-400 hover:text-white font-semibold text-lg", children: [_jsx("span", { className: "text-2xl", children: "\uD83C\uDFE0" }), _jsx("span", { className: "ml-2", children: t('home') })] }), isAuthenticated && (_jsxs("nav", { className: "flex flex-wrap items-center gap-4 text-sm font-medium", children: [navItems.map(({ to, icon, label }) => (_jsxs(Link, { to: to, className: `flex items-center gap-1 px-2 py-1 rounded hover:text-blue-400 transition-colors ${location.pathname === to ? 'text-blue-400' : 'text-white'}`, children: [_jsx("span", { children: icon }), label] }, to))), isFounder && (_jsxs(_Fragment, { children: [_jsxs(Link, { to: "/admin/security", className: `flex items-center gap-1 px-2 py-1 rounded hover:text-blue-400 transition-colors ${location.pathname === '/admin/security' ? 'text-blue-400' : 'text-white'}`, children: [_jsx("span", { children: "\uD83D\uDEE1\uFE0F" }), "Security"] }), _jsxs(Link, { to: "/admin/founder-control", className: `flex items-center gap-1 px-2 py-1 rounded hover:text-blue-400 transition-colors ${location.pathname === '/admin/founder-control' ? 'text-blue-400' : 'text-white'}`, children: [_jsx("span", { children: "\uD83E\uDDF0" }), "Founder Control"] }), _jsx(Link, { to: "/safe-owner/help", className: "text-xs text-blue-400 underline hover:text-white", children: "\uD83D\uDCD8 Panel Guide" }), _jsx(Link, { to: "/safe-owner/settings", className: "text-xs text-blue-400 underline hover:text-white", children: "\uD83D\uDEE0\uFE0F Settings" })] })), _jsx(LanguageDropdown, {}), _jsx("button", { onClick: toggleDark, className: "px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 transition", "aria-label": "Toggle theme", children: isDark ? `🌞 ${t('light')}` : `🌙 ${t('dark')}` }), _jsxs("button", { onClick: handleLogout, className: "px-3 py-1 rounded bg-red-600 hover:bg-red-500 text-white transition", children: ["\uD83D\uDEAA ", t('logout')] })] }))] }) }));
}
