import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// ≡ƒôü src/App.tsx
import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { I18nextProvider } from 'react-i18next';
import i18n from './lib/i18n.config';
import { useDarkMode } from '@context/DarkModeContext';
import { useAuth } from '@context/AuthContext';
import { AITrainingInfoProvider } from '@context/AITrainingInfoContext';
import Navbar from '@components/Navbar';
import Breadcrumbs from '@components/Breadcrumbs';
import LockCheckWrapper from '@components/LockCheckWrapper';
import ProtectedRoute from '@components/ProtectedRoute';
import FounderRoute from '@components/FounderRoute';
import LockedPage from '@pages/LockedPage';
import AdminLogin from '@pages/Login';
import Unauthorized from '@pages/Unauthorized';
import { isAllowedHost } from './lib/hostGuard';
// Admin Pages
import Dashboard from '@pages/admin/Dashboard';
import AddNews from '@pages/AddNews';
import EditNews from '@pages/EditNews';
import ManageNews from '@pages/ManageNews';
import AddCategory from '@pages/AddCategory';
import LanguageSettings from '@pages/owner/LanguageSettings';
import PushHistory from '@pages/PushHistory';
import SavedNews from '@pages/SavedNews';
import TestNotification from '@pages/TestNotification';
import InspirationHub from '@pages/inspiration/InspirationHub';
// Polls
import PollOfTheDay from '@pages/PollOfTheDay';
import PollEditor from '@pages/PollEditor';
import PollResultsChart from '@pages/polls/PollResultsChart';
// Founder-Only Pages
import SafeOwnerZone from '@pages/admin/SafeOwnerZone';
import LanguageManager from '@pages/SafeOwner/LanguageManager';
import PanelGuide from '@pages/SafeOwner/PanelGuide';
import UpdateFounderPIN from '@pages/admin/UpdateFounderPIN';
import AdminControlCenter from '@components/AdminControlCenter';
import FeatureHelpPanel from '@components/SafeZone/FeatureHelpPanel';
import LiveFeedManager from '@pages/admin/LiveFeedManager';
import EmbedManager from '@pages/admin/EmbedManager';
import ToggleControls from '@pages/admin/ToggleControls';
import ControlConstitution from '@pages/admin/ControlConstitution';
import Diagnostics from '@pages/admin/Diagnostics';
// Advanced Modules
import AIEditorialAssistant from '@components/advanced/AIEditorialAssistant';
import EnhancedSecurityDashboard from '@components/advanced/EnhancedSecurityDashboard';
import EditorialWorkflowEngine from '@components/advanced/EditorialWorkflowEngine';
import FounderControlCenter from '@components/advanced/FounderControlCenter';
import FounderControlPage from '@pages/admin/founder-control';
import MediaLibrary from '@components/advanced/MediaLibrary';
import AnalyticsDashboard from '@components/advanced/AnalyticsDashboard';
import WebStoriesEditor from '@components/advanced/WebStoriesEditor';
import CommentModerationDashboard from '@components/advanced/CommentModerationDashboard';
import SEOToolsDashboard from '@components/advanced/SEOToolsDashboard';
import AIEngine from '@pages/admin/AIEngine';
import Aira from '@pages/admin/Aira';
import YouthPulse from '@pages/admin/YouthPulse';
import Editorial from '@pages/admin/Editorial';
import GlobalCommandPalette from '@components/GlobalCommandPalette';
function App() {
    const { isDark } = useDarkMode();
    const { isAuthenticated } = useAuth();
    const [paletteOpen, setPaletteOpen] = useState(false);
    useEffect(() => {
        document.documentElement.classList.toggle('dark', isDark);
    }, [isDark]);
    // Global hotkeys: Ctrl/Cmd+K to open, Esc to close
    useEffect(() => {
        const onKey = (e) => {
            const isCmdOrCtrl = e.ctrlKey || e.metaKey;
            if (isCmdOrCtrl && (e.key.toLowerCase() === 'k')) {
                e.preventDefault();
                setPaletteOpen((v) => !v);
            }
            if (e.key === 'Escape')
                setPaletteOpen(false);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);
    return (_jsx(AITrainingInfoProvider, { children: _jsx(I18nextProvider, { i18n: i18n, children: _jsxs("div", { className: `min-h-screen transition-colors duration-300 ${isDark ? 'bg-slate-900 text-white' : 'bg-white text-black'}`, children: [_jsx(Navbar, {}), isAuthenticated && _jsx(Breadcrumbs, {}), !isAllowedHost() ? (_jsx("div", { className: "p-10 text-center text-red-600 text-2xl font-bold", children: "\u274C Access Denied \u2014 Host not allowed" })) : null, _jsx("main", { className: "p-4 md:p-6 max-w-7xl mx-auto", children: _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(Navigate, { to: "/admin/dashboard", replace: true }) }), _jsx(Route, { path: "/add", element: _jsx(ProtectedRoute, { children: _jsx(LockCheckWrapper, { children: _jsx(AddNews, {}) }) }) }), _jsx(Route, { path: "/edit/:id", element: _jsx(ProtectedRoute, { children: _jsx(LockCheckWrapper, { children: _jsx(EditNews, {}) }) }) }), _jsx(Route, { path: "/push-history", element: _jsx(ProtectedRoute, { children: _jsx(LockCheckWrapper, { children: _jsx(PushHistory, {}) }) }) }), _jsx(Route, { path: "/add-category", element: _jsx(ProtectedRoute, { children: _jsx(LockCheckWrapper, { children: _jsx(AddCategory, {}) }) }) }), _jsx(Route, { path: "/language-settings", element: _jsx(ProtectedRoute, { children: _jsx(LockCheckWrapper, { children: _jsx(LanguageSettings, {}) }) }) }), _jsx(Route, { path: "/poll-editor", element: _jsx(ProtectedRoute, { children: _jsx(LockCheckWrapper, { children: _jsx(PollEditor, {}) }) }) }), _jsx(Route, { path: "/poll-results", element: _jsx(ProtectedRoute, { children: _jsx(LockCheckWrapper, { children: _jsx(PollResultsChart, {}) }) }) }), _jsx(Route, { path: "/manage-news", element: _jsx(ProtectedRoute, { children: _jsx(LockCheckWrapper, { children: _jsx(ManageNews, {}) }) }) }), _jsx(Route, { path: "/test-push", element: _jsx(ProtectedRoute, { children: _jsx(LockCheckWrapper, { children: _jsx(TestNotification, {}) }) }) }), _jsx(Route, { path: "/saved-news", element: _jsx(ProtectedRoute, { children: _jsx(LockCheckWrapper, { children: _jsx(SavedNews, {}) }) }) }), _jsx(Route, { path: "/media/inspiration", element: _jsx(ProtectedRoute, { children: _jsx(LockCheckWrapper, { children: _jsx(InspirationHub, {}) }) }) }), _jsx(Route, { path: "/poll", element: _jsx(ProtectedRoute, { children: _jsx(LockCheckWrapper, { children: _jsx(PollOfTheDay, {}) }) }) }), _jsx(Route, { path: "/admin/locked", element: _jsx(LockedPage, {}) }), _jsx(Route, { path: "/admin/dashboard", element: _jsx(FounderRoute, { children: _jsx(Dashboard, {}) }) }), _jsx(Route, { path: "/safe-owner", element: _jsx(FounderRoute, { children: _jsx(SafeOwnerZone, {}) }) }), _jsx(Route, { path: "/safe-owner/help", element: _jsx(FounderRoute, { children: _jsx(FeatureHelpPanel, {}) }) }), _jsx(Route, { path: "/safe-owner/settings", element: _jsx(FounderRoute, { children: _jsx(AdminControlCenter, {}) }) }), _jsx(Route, { path: "/safe-owner/language-settings", element: _jsx(FounderRoute, { children: _jsx(LanguageManager, {}) }) }), _jsx(Route, { path: "/safe-owner/panel-guide", element: _jsx(FounderRoute, { children: _jsx(PanelGuide, {}) }) }), _jsx(Route, { path: "/safe-owner/update-pin", element: _jsx(FounderRoute, { children: _jsx(UpdateFounderPIN, {}) }) }), _jsx(Route, { path: "/admin/live-feed-manager", element: _jsx(FounderRoute, { children: _jsx(LiveFeedManager, {}) }) }), _jsx(Route, { path: "/admin/embed-manager", element: _jsx(FounderRoute, { children: _jsx(EmbedManager, {}) }) }), _jsx(Route, { path: "/admin/toggle-controls", element: _jsx(FounderRoute, { children: _jsx(ToggleControls, {}) }) }), _jsx(Route, { path: "/admin/control-constitution", element: _jsx(FounderRoute, { children: _jsx(ControlConstitution, {}) }) }), _jsx(Route, { path: "/admin/diagnostics", element: _jsx(FounderRoute, { children: _jsx(Diagnostics, {}) }) }), _jsx(Route, { path: "/admin/ai-engine", element: _jsx(FounderRoute, { children: _jsx(AIEngine, {}) }) }), _jsx(Route, { path: "/admin/aira", element: _jsx(FounderRoute, { children: _jsx(Aira, {}) }) }), _jsx(Route, { path: "/admin/youth-pulse", element: _jsx(ProtectedRoute, { children: _jsx(YouthPulse, {}) }) }), _jsx(Route, { path: "/admin/editorial", element: _jsx(ProtectedRoute, { children: _jsx(Editorial, {}) }) }), _jsx(Route, { path: "/admin/ai-assistant", element: _jsx(ProtectedRoute, { children: _jsx(AIEditorialAssistant, {}) }) }), _jsx(Route, { path: "/admin/workflow", element: _jsx(ProtectedRoute, { children: _jsx(EditorialWorkflowEngine, {}) }) }), _jsx(Route, { path: "/admin/media-library", element: _jsx(ProtectedRoute, { children: _jsx(MediaLibrary, {}) }) }), _jsx(Route, { path: "/admin/analytics", element: _jsx(ProtectedRoute, { children: _jsx(AnalyticsDashboard, {}) }) }), _jsx(Route, { path: "/admin/security", element: _jsx(FounderRoute, { children: _jsx(EnhancedSecurityDashboard, {}) }) }), _jsx(Route, { path: "/admin/web-stories", element: _jsx(ProtectedRoute, { children: _jsx(WebStoriesEditor, {}) }) }), _jsx(Route, { path: "/admin/moderation", element: _jsx(ProtectedRoute, { children: _jsx(CommentModerationDashboard, {}) }) }), _jsx(Route, { path: "/admin/seo", element: _jsx(ProtectedRoute, { children: _jsx(SEOToolsDashboard, {}) }) }), _jsx(Route, { path: "/admin/founder-control", element: _jsx(FounderRoute, { children: _jsx(FounderControlCenter, {}) }) }), _jsx(Route, { path: "/admin/founder", element: _jsx(FounderRoute, { children: _jsx(FounderControlPage, {}) }) }), _jsx(Route, { path: "/login", element: _jsx(AdminLogin, {}) }), _jsx(Route, { path: "/admin/login", element: _jsx(AdminLogin, {}) }), _jsx(Route, { path: "/unauthorized", element: _jsx(Unauthorized, {}) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/admin/dashboard", replace: true }) })] }) }), _jsx(GlobalCommandPalette, { open: paletteOpen, onClose: () => setPaletteOpen(false) }), _jsx(Toaster, { position: "top-right", toastOptions: { duration: 3000 } })] }) }) }));
}
export default App;
