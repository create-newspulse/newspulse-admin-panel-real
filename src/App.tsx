// 📁 src/App.tsx

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
import MediaLibrary from '@components/advanced/MediaLibrary';
import AnalyticsDashboard from '@components/advanced/AnalyticsDashboard';
import WebStoriesEditor from '@components/advanced/WebStoriesEditor';
import CommentModerationDashboard from '@components/advanced/CommentModerationDashboard';
import SEOToolsDashboard from '@components/advanced/SEOToolsDashboard';
import AIEngine from '@pages/admin/AIEngine';
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
    const onKey = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;
      if (isCmdOrCtrl && (e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if (e.key === 'Escape') setPaletteOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <AITrainingInfoProvider>
      <I18nextProvider i18n={i18n}>
        <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-slate-900 text-white' : 'bg-white text-black'}`}>
          <Navbar />
          {isAuthenticated && <Breadcrumbs />}

          {/* Host allow-list guard prevents preview lockouts. Empty allow-list = allow all. */}
          {!isAllowedHost() ? (
            <div className="p-10 text-center text-red-600 text-2xl font-bold">❌ Access Denied — Host not allowed</div>
          ) : null}

          <main className="p-4 md:p-6 max-w-7xl mx-auto">
            <Routes>
              {/* 🧭 Default Redirect to Admin Dashboard */}
              <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />

              {/* 🔐 Admin Protected Routes */}
              <Route path="/add" element={<ProtectedRoute><LockCheckWrapper><AddNews /></LockCheckWrapper></ProtectedRoute>} />
              <Route path="/edit/:id" element={<ProtectedRoute><LockCheckWrapper><EditNews /></LockCheckWrapper></ProtectedRoute>} />
              <Route path="/push-history" element={<ProtectedRoute><LockCheckWrapper><PushHistory /></LockCheckWrapper></ProtectedRoute>} />
              <Route path="/add-category" element={<ProtectedRoute><LockCheckWrapper><AddCategory /></LockCheckWrapper></ProtectedRoute>} />
              <Route path="/language-settings" element={<ProtectedRoute><LockCheckWrapper><LanguageSettings /></LockCheckWrapper></ProtectedRoute>} />
              <Route path="/poll-editor" element={<ProtectedRoute><LockCheckWrapper><PollEditor /></LockCheckWrapper></ProtectedRoute>} />
              <Route path="/poll-results" element={<ProtectedRoute><LockCheckWrapper><PollResultsChart /></LockCheckWrapper></ProtectedRoute>} />
              <Route path="/manage-news" element={<ProtectedRoute><LockCheckWrapper><ManageNews /></LockCheckWrapper></ProtectedRoute>} />
              {/* AI Test route removed in favor of the new AI Engine */}
              <Route path="/test-push" element={<ProtectedRoute><LockCheckWrapper><TestNotification /></LockCheckWrapper></ProtectedRoute>} />
              <Route path="/saved-news" element={<ProtectedRoute><LockCheckWrapper><SavedNews /></LockCheckWrapper></ProtectedRoute>} />
              <Route path="/media/inspiration" element={<ProtectedRoute><LockCheckWrapper><InspirationHub /></LockCheckWrapper></ProtectedRoute>} />
              <Route path="/poll" element={<ProtectedRoute><LockCheckWrapper><PollOfTheDay /></LockCheckWrapper></ProtectedRoute>} />
              <Route path="/admin/locked" element={<LockedPage />} />

              {/* 🛡️ Founder-Only Routes */}
              <Route path="/admin/dashboard" element={<FounderRoute><Dashboard /></FounderRoute>} />
              <Route path="/safe-owner" element={<FounderRoute><SafeOwnerZone /></FounderRoute>} />
              <Route path="/safe-owner/help" element={<FounderRoute><FeatureHelpPanel /></FounderRoute>} />
              <Route path="/safe-owner/settings" element={<FounderRoute><AdminControlCenter /></FounderRoute>} />
              <Route path="/safe-owner/language-settings" element={<FounderRoute><LanguageManager /></FounderRoute>} />
              <Route path="/safe-owner/panel-guide" element={<FounderRoute><PanelGuide /></FounderRoute>} />
              <Route path="/safe-owner/update-pin" element={<FounderRoute><UpdateFounderPIN /></FounderRoute>} />
              <Route path="/admin/live-feed-manager" element={<FounderRoute><LiveFeedManager /></FounderRoute>} />
              <Route path="/admin/embed-manager" element={<FounderRoute><EmbedManager /></FounderRoute>} />
              <Route path="/admin/toggle-controls" element={<FounderRoute><ToggleControls /></FounderRoute>} />
              <Route path="/admin/control-constitution" element={<FounderRoute><ControlConstitution /></FounderRoute>} />
              <Route path="/admin/diagnostics" element={<FounderRoute><Diagnostics /></FounderRoute>} />
              <Route path="/admin/ai-engine" element={<FounderRoute><AIEngine /></FounderRoute>} />

              {/* 🚀 Advanced Modules */}
              <Route path="/admin/ai-assistant" element={<ProtectedRoute><AIEditorialAssistant /></ProtectedRoute>} />
              <Route path="/admin/workflow" element={<ProtectedRoute><EditorialWorkflowEngine /></ProtectedRoute>} />
              <Route path="/admin/media-library" element={<ProtectedRoute><MediaLibrary /></ProtectedRoute>} />
              <Route path="/admin/analytics" element={<ProtectedRoute><AnalyticsDashboard /></ProtectedRoute>} />
              <Route path="/admin/security" element={<FounderRoute><EnhancedSecurityDashboard /></FounderRoute>} />
              <Route path="/admin/web-stories" element={<ProtectedRoute><WebStoriesEditor /></ProtectedRoute>} />
              <Route path="/admin/moderation" element={<ProtectedRoute><CommentModerationDashboard /></ProtectedRoute>} />
              <Route path="/admin/seo" element={<ProtectedRoute><SEOToolsDashboard /></ProtectedRoute>} />
              <Route path="/admin/founder-control" element={<FounderRoute><FounderControlCenter /></FounderRoute>} />

              {/* 🔐 Login + Fallback */}
              <Route path="/login" element={<AdminLogin />} />
              <Route path="/unauthorized" element={<Unauthorized />} />
              <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
            </Routes>
          </main>

          {/* 🔎 Global Command Palette (Ctrl/Cmd+K) */}
          <GlobalCommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

          <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
        </div>
      </I18nextProvider>
    </AITrainingInfoProvider>
  );
}

export default App;
