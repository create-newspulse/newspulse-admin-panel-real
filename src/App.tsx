// 📁 src/App.tsx

import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import { I18nextProvider } from 'react-i18next';
import i18n from './lib/i18n.config';

import { useDarkMode } from '@context/DarkModeContext';
import { useAuth } from '@context/AuthContext';
import { AITrainingInfoProvider } from '@context/AITrainingInfoContext';
import { PublishFlagProvider } from '@/context/PublishFlagContext';

import Navbar from '@components/Navbar';
import Breadcrumbs from '@components/Breadcrumbs';
import LockCheckWrapper from '@components/LockCheckWrapper';
import ProtectedRoute from '@components/ProtectedRoute';
import FounderRoute from '@components/FounderRoute';

// Use explicit extension so Vercel resolver doesn't miss the TSX file
import LockedPage from '@pages/LockedPage.tsx';
// Legacy AdminLogin kept for reference; not used now that /admin/login uses SimpleLogin
import Unauthorized from '@pages/Unauthorized';
import { isAllowedHost } from './lib/hostGuard';

// Admin Pages
import Dashboard from '@pages/admin/Dashboard';
import AddNews from '@pages/AddNews';
import EditNews from '@pages/EditNews'; // legacy editor (kept for backward compatibility)
import ArticleEditPage from '@pages/ArticleEditPage';
import ManageNews from '@pages/ManageNews';
import AddCategory from '@pages/AddCategory';
import LanguageSettings from '@pages/owner/LanguageSettings';
import PushHistory from '@pages/PushHistory';
import SavedNews from '@pages/SavedNews';
import TestNotification from '@pages/TestNotification';

// Polls
import PollOfTheDay from '@pages/PollOfTheDay';
import PollEditor from '@pages/PollEditor';
import PollResultsChart from '@pages/polls/PollResultsChart';

// Founder-Only Pages
// Legacy SafeOwnerZone page is no longer imported (redirect handles the path)
import LanguageManager from '@pages/SafeOwner/LanguageManager';
import PanelGuide from '@pages/SafeOwner/PanelGuide';
import UpdateFounderPIN from '@pages/admin/UpdateFounderPIN';
import AdminControlCenter from '@components/AdminControlCenter';
import LiveFeedManager from '@pages/admin/LiveFeedManager';
import LiveTVControl from '@pages/admin/LiveTVControl';
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
import FeatureTogglesPage from '@pages/founder/FeatureTogglesPage';
import FeatureTogglesCommunityReporter from '@/pages/founder/FeatureTogglesCommunityReporter';
// Temporary import of Community Reporter page from legacy admin folder until unified move
import CommunityReporterPage from '@pages/admin/CommunityReporterPage';
import CommunityReporterDetailPage from '@pages/admin/CommunityReporterDetailPage';
import MediaLibrary from '@components/advanced/MediaLibrary';
import AnalyticsDashboard from '@components/advanced/AnalyticsDashboard';
import WebStoriesEditor from '@components/advanced/WebStoriesEditor';
import CommentModerationDashboard from '@components/advanced/CommentModerationDashboard';
import SEOToolsDashboard from '@components/advanced/SEOToolsDashboard';
import AIEngine from '@pages/admin/AIEngine';
import ChangePassword from '@pages/admin/ChangePassword';
import Aira from '@pages/admin/Aira';
import YouthPulse from '@pages/admin/YouthPulse';
import Editorial from '@pages/admin/Editorial';
import DraftDeskPage from '@pages/admin/DraftDeskPage';
import SubmitCommunityStory from '@pages/community/SubmitCommunityStory';
import MyCommunityStories from '@pages/community/MyCommunityStories';
import ReporterPortal from '@pages/community/ReporterPortal';
import CommunityHome from '@pages/community/CommunityHome';
import ReporterContactDirectory from '@pages/community/ReporterContactDirectory';
import ReporterStoriesAdmin from '@pages/community/ReporterStoriesAdmin';
import JournalistApplications from '@pages/community/JournalistApplications';
import ReporterPortalPreview from '@pages/community/ReporterPortalPreview';
import GlobalCommandPalette from '@components/GlobalCommandPalette';
import EnvTest from '@components/EnvTest';
import NotFound from '@pages/NotFound';
import Denied from '@pages/Denied';
// Settings Center (admin)
import SettingsLayout from '@pages/admin/settings/SettingsLayout';
import SettingsHome from '@pages/admin/settings/SettingsHome';
import FrontendUiSettings from '@pages/admin/settings/FrontendUiSettings';
import NavigationSettings from '@pages/admin/settings/NavigationSettings';
import PublishingSettings from '@pages/admin/settings/PublishingSettings';
import AIModulesSettings from '@pages/admin/settings/AIModulesSettings';
import VoiceLanguagesSettings from '@pages/admin/settings/VoiceLanguagesSettings';
import CommunitySettings from '@pages/admin/settings/CommunitySettings';
import MonetizationSettings from '@pages/admin/settings/MonetizationSettings';
import IntegrationsSettings from '@pages/admin/settings/IntegrationsSettings';
import SecuritySettings from '@pages/admin/settings/SecuritySettings';
import BackupsSettings from '@pages/admin/settings/BackupsSettings';
import AuditLogsSettings from '@pages/admin/settings/AuditLogsSettings';
import PanelRouter from '@/routes/PanelRouter';
// UnifiedLogin deprecated in favor of SimpleLogin for a single flow
import SimpleLogin from '@pages/auth/SimpleLogin';
import { RequireRole } from '@/routes/guards';
import SafeOwnerZoneLayout from '@/pages/admin/safe-owner-zone/SafeOwnerZoneLayout';
import SafeOwnerZoneHub from '@/pages/admin/safe-owner-zone/SafeOwnerZoneHub';
import SafeOwnerZoneModule from '@/pages/admin/safe-owner-zone/SafeOwnerZoneModule';

function LegacySafeOwnerZoneRedirect() {
  const { module } = useParams();
  const m = String(module || '').toLowerCase();
  const map: Record<string, string> = {
    founder: 'founder',
    security: 'security-lockdown',
    compliance: 'compliance',
    ai: 'ai-control',
    vaults: 'vaults',
    ops: 'operations',
    revenue: 'revenue',
    admin: 'admin-oversight',
  };
  const slug = map[m];
  return <Navigate to={slug ? `/admin/safe-owner-zone/${slug}` : '/admin/safe-owner-zone'} replace />;
}

function App() {
  console.log('Router loaded: main admin router');
  const { isDark } = useDarkMode();
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const isAuthPage = ['/login','/admin/login','/employee/login'].includes(location.pathname);
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
      <PublishFlagProvider>
      <I18nextProvider i18n={i18n}>
        <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-slate-900 text-white' : 'bg-white text-black'}`}>
          <Navbar />
          {/* Optional: lightweight env overlay for debugging prod vs local differences */}
          {import.meta.env.VITE_SHOW_ENV_TEST === 'true' && <EnvTest />}
          {isAuthenticated && !isAuthPage && <Breadcrumbs />}

          {/* Host allow-list guard prevents preview lockouts. Empty allow-list = allow all. */}
          {!isAllowedHost() ? (
            <div className="p-10 text-center text-red-600 text-2xl font-bold">❌ Access Denied — Host not allowed</div>
          ) : null}

          <main className="p-4 md:p-6 max-w-7xl mx-auto">
            <Routes>
              {/* 🧭 Default Redirect to Admin Dashboard */}
              <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
              {/* New role-based panel (founder/admin/employee) */}
              <Route path="/panel/*" element={<PanelRouter />} />

              {/* 🔐 Admin Protected Routes */}
              {/* Legacy /add now redirects to /admin/add-news (updated editor) */}
              <Route path="/add" element={<AddNews />} />
              <Route path="/edit/:id" element={<ProtectedRoute><LockCheckWrapper><EditNews /></LockCheckWrapper></ProtectedRoute>} />
              {/* New dedicated modern edit route using ArticleForm */}
              <Route path="/admin/articles/:id/edit" element={<ProtectedRoute><LockCheckWrapper><ArticleEditPage /></LockCheckWrapper></ProtectedRoute>} />
              <Route path="/push-history" element={<ProtectedRoute><LockCheckWrapper><PushHistory /></LockCheckWrapper></ProtectedRoute>} />
              <Route path="/add-category" element={<ProtectedRoute><LockCheckWrapper><AddCategory /></LockCheckWrapper></ProtectedRoute>} />
              <Route path="/language-settings" element={<ProtectedRoute><LockCheckWrapper><LanguageSettings /></LockCheckWrapper></ProtectedRoute>} />
              <Route path="/poll-editor" element={<ProtectedRoute><LockCheckWrapper><PollEditor /></LockCheckWrapper></ProtectedRoute>} />
              <Route path="/poll-results" element={<ProtectedRoute><LockCheckWrapper><PollResultsChart /></LockCheckWrapper></ProtectedRoute>} />
              {/* Add News legacy redirect */}
              <Route path="/admin/add" element={<Navigate to="/add" replace />} />
              {/* Manage News canonical route + redirects */}
              <Route path="/admin/articles" element={<ProtectedRoute><LockCheckWrapper><ManageNews /></LockCheckWrapper></ProtectedRoute>} />
              <Route path="/manage-news" element={<Navigate to="/admin/articles" replace />} />
              <Route path="/admin/manage-news" element={<Navigate to="/admin/articles" replace />} />
              <Route path="/admin/news" element={<Navigate to="/admin/articles" replace />} />
              <Route path="/admin/manage" element={<Navigate to="/admin/articles" replace />} />
              {/* Draft Desk */}
              <Route path="/admin/drafts" element={<ProtectedRoute><LockCheckWrapper><DraftDeskPage /></LockCheckWrapper></ProtectedRoute>} />
              {/* Community Reporter Queue & Detail */}
              <Route path="/admin/community-reporter" element={<ProtectedRoute><CommunityReporterPage /></ProtectedRoute>} />
              {/* New canonical community reporter queue route (founder/admin view) */}
              <Route path="/community/reporter" element={<ProtectedRoute><CommunityReporterPage /></ProtectedRoute>} />
              {/* Community Hub root */}
              <Route path="/community" element={<ProtectedRoute><LockCheckWrapper><CommunityHome /></LockCheckWrapper></ProtectedRoute>} />
              <Route path="/admin/community-reporter/:id" element={<ProtectedRoute><CommunityReporterDetailPage /></ProtectedRoute>} />
              {/* Community Reporter – Submit Story (admin + public alias) */}
              <Route path="/admin/community/submit" element={<ProtectedRoute><LockCheckWrapper><SubmitCommunityStory /></LockCheckWrapper></ProtectedRoute>} />
              <Route path="/community/submit" element={<ProtectedRoute><LockCheckWrapper><SubmitCommunityStory /></LockCheckWrapper></ProtectedRoute>} />
              {/* Community Reporter – My Stories (admin + public alias) */}
              <Route path="/admin/community/my-stories" element={<ProtectedRoute><LockCheckWrapper><MyCommunityStories /></LockCheckWrapper></ProtectedRoute>} />
              <Route path="/community/my-stories" element={<ProtectedRoute><LockCheckWrapper><MyCommunityStories /></LockCheckWrapper></ProtectedRoute>} />
              {/* Reporter Stories (admin-only, read-only) - query-param style */}
              <Route path="/community/reporter-stories" element={<ProtectedRoute><LockCheckWrapper><ReporterStoriesAdmin /></LockCheckWrapper></ProtectedRoute>} />
              {/* Legacy path-param variant retained for backward compatibility: redirect to query style */}
              <Route path="/community/reporter-stories/:reporterKey" element={<Navigate replace to="/community/reporter-stories" />} />
              {/* Reporter Contact Directory (founder/admin only) */}
              <Route path="/community/reporter-contacts" element={<ProtectedRoute><LockCheckWrapper><ReporterContactDirectory /></LockCheckWrapper></ProtectedRoute>} />
              {/* Journalist Applications (founder/admin only) */}
              <Route path="/community/journalist-applications" element={<ProtectedRoute><LockCheckWrapper><JournalistApplications /></LockCheckWrapper></ProtectedRoute>} />
              {/* Reporter Portal (admin + public alias) */}
              <Route path="/admin/community/portal" element={<ProtectedRoute><LockCheckWrapper><ReporterPortal /></LockCheckWrapper></ProtectedRoute>} />
              <Route path="/community/portal" element={<ProtectedRoute><LockCheckWrapper><ReporterPortal /></LockCheckWrapper></ProtectedRoute>} />
              {/* Internal founder-only Reporter Portal preview */}
              <Route path="/community/reporter-portal" element={<FounderRoute><ReporterPortalPreview /></FounderRoute>} />
              {/* AI Test route removed in favor of the new AI Engine */}
              <Route path="/test-push" element={<ProtectedRoute><LockCheckWrapper><TestNotification /></LockCheckWrapper></ProtectedRoute>} />
              <Route path="/saved-news" element={<ProtectedRoute><LockCheckWrapper><SavedNews /></LockCheckWrapper></ProtectedRoute>} />
              <Route path="/poll" element={<ProtectedRoute><LockCheckWrapper><PollOfTheDay /></LockCheckWrapper></ProtectedRoute>} />
              <Route path="/admin/locked" element={<LockedPage />} />

              {/* 🛡️ Founder-Only Routes */}
              <Route path="/admin/dashboard" element={<FounderRoute><Dashboard /></FounderRoute>} />
              {/* Settings Center (layout + minimal routes) */}
              <Route path="/admin/settings" element={<ProtectedRoute><SettingsLayout /></ProtectedRoute>}>
                <Route index element={<SettingsHome />} />
                <Route path="frontend-ui" element={<FrontendUiSettings />} />
                <Route path="navigation" element={<NavigationSettings />} />
                <Route path="publishing" element={<PublishingSettings />} />
                <Route path="ai-modules" element={<AIModulesSettings />} />
                <Route path="voice-languages" element={<VoiceLanguagesSettings />} />
                <Route path="community" element={<CommunitySettings />} />
                <Route path="monetization" element={<MonetizationSettings />} />
                <Route path="integrations" element={<IntegrationsSettings />} />
                <Route path="security" element={<FounderRoute><SecuritySettings /></FounderRoute>} />
                <Route path="backups" element={<FounderRoute><BackupsSettings /></FounderRoute>} />
                <Route path="audit-logs" element={<AuditLogsSettings />} />
              </Route>
              {/* Redirect /founder → /founder/feature-toggles */}
              <Route path="/founder" element={<Navigate to="/founder/feature-toggles" replace />} />
              {/* Founder-only Feature Toggles – Community Reporter */}
              <Route path="/founder/feature-toggles" element={<FounderRoute><FeatureTogglesCommunityReporter /></FounderRoute>} />
              {/* Legacy path kept as redirect for backward compatibility */}
              <Route path="/safe-owner" element={<Navigate to="/admin/safe-owner-zone" replace />} />
              {/* New canonical Safe Owner Zone hub */}
              <Route
                path="/admin/safe-owner-zone"
                element={
                  <RequireRole allow={['founder', 'admin']}>
                    <SafeOwnerZoneLayout />
                  </RequireRole>
                }
              >
                <Route index element={<SafeOwnerZoneHub />} />
                <Route path="founder" element={<SafeOwnerZoneModule slug="founder" />} />
                <Route path="security-lockdown" element={<SafeOwnerZoneModule slug="security-lockdown" />} />
                <Route path="compliance" element={<SafeOwnerZoneModule slug="compliance" />} />
                <Route path="ai-control" element={<SafeOwnerZoneModule slug="ai-control" />} />
                <Route path="vaults" element={<SafeOwnerZoneModule slug="vaults" />} />
                <Route path="operations" element={<SafeOwnerZoneModule slug="operations" />} />
                <Route path="revenue" element={<SafeOwnerZoneModule slug="revenue" />} />
                <Route path="admin-oversight" element={<SafeOwnerZoneModule slug="admin-oversight" />} />
              </Route>

              <Route path="/safe-owner/settings" element={<FounderRoute><AdminControlCenter /></FounderRoute>} />
              <Route path="/safe-owner/language-settings" element={<FounderRoute><LanguageManager /></FounderRoute>} />
              <Route path="/safe-owner/panel-guide" element={<FounderRoute><PanelGuide /></FounderRoute>} />
              <Route path="/safe-owner/update-pin" element={<FounderRoute><UpdateFounderPIN /></FounderRoute>} />
              <Route path="/admin/live-feed-manager" element={<FounderRoute><LiveFeedManager /></FounderRoute>} />
              <Route path="/admin/embed-manager" element={<FounderRoute><EmbedManager /></FounderRoute>} />
              {/* Live TV */}
              <Route path="/admin/live" element={<ProtectedRoute><LiveTVControl /></ProtectedRoute>} />
              <Route path="/admin/toggle-controls" element={<FounderRoute><ToggleControls /></FounderRoute>} />
              <Route path="/admin/control-constitution" element={<FounderRoute><ControlConstitution /></FounderRoute>} />
              <Route path="/admin/diagnostics" element={<FounderRoute><Diagnostics /></FounderRoute>} />
              <Route path="/admin/ai-engine" element={<FounderRoute><AIEngine /></FounderRoute>} />
              <Route path="/admin/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
              <Route path="/admin/aira" element={<FounderRoute><Aira /></FounderRoute>} />
              <Route path="/admin/youth-pulse" element={<ProtectedRoute><YouthPulse /></ProtectedRoute>} />
              <Route path="/admin/editorial" element={<ProtectedRoute><Editorial /></ProtectedRoute>} />

              {/* Legacy Safe Owner Zone v5 routes: redirect to canonical /admin/safe-owner-zone */}
              <Route path="/safeownerzone" element={<Navigate to="/admin/safe-owner-zone" replace />} />
              <Route path="/safeownerzone/:module" element={<LegacySafeOwnerZoneRedirect />} />

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
              {/* New Founder Control route alias */}
              <Route path="/admin/founder" element={<FounderRoute><FounderControlPage /></FounderRoute>} />


              {/* 🔐 Login + Fallback */}
              {/* Keep only one login system (NewsPulse React login) */}
              <Route path="/auth" element={<Navigate to="/admin/login" replace />} />
              <Route path="/auth/unified" element={<Navigate to="/admin/login" replace />} />
              <Route path="/auth/simple" element={<SimpleLogin />} />
              {/* Redirect generic /login to the React login */}
              <Route path="/login" element={<Navigate to="/admin/login" replace />} />
              {/* NewsPulse login */}
              <Route path="/admin/login" element={<SimpleLogin />} />
              {/* Placeholder employee login redirect (no separate UI yet) */}
              <Route path="/employee/login" element={<SimpleLogin />} />
              <Route path="/denied" element={<Denied />} />
              <Route path="/unauthorized" element={<Unauthorized />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>

          {/* 🔎 Global Command Palette (Ctrl/Cmd+K) */}
          <GlobalCommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

          <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
        </div>
      </I18nextProvider>
      </PublishFlagProvider>
    </AITrainingInfoProvider>
  );
}

export default App;

