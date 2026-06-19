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
import OwnerBar from '@/components/OwnerBar';
import ProtectedRoute from '@components/ProtectedRoute';
import FounderRoute from '@components/FounderRoute';
import AdminModuleRoute from '@components/AdminModuleRoute';

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
import AdsManager from '@pages/AdsManager';
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
import ArticlesAnalyticsPage from '@/pages/admin/analytics/ArticlesAnalyticsPage';
import CategoriesAnalyticsPage from '@/pages/admin/analytics/CategoriesAnalyticsPage';
import ComplianceReportsPage from '@/pages/admin/ComplianceReportsPage';
import FinanceDesk from '@pages/admin/FinanceDesk';
import WebStoriesEditor from '@components/advanced/WebStoriesEditor';
import CommentModerationDashboard from '@components/advanced/CommentModerationDashboard';
import SEOToolsDashboard from '@components/advanced/SEOToolsDashboard';
import AIEngine from '@pages/admin/AIEngine';
import ChangePassword from '@pages/admin/ChangePassword';
import Aira from '@pages/admin/Aira';
import YouthPulse from '@pages/admin/YouthPulse';
import Editorial from '@pages/admin/Editorial';
import DraftDeskPage from '@pages/admin/DraftDeskPage';
import DraftWorkspacePage from '@pages/admin/DraftWorkspacePage';
import MyCommunityStories from '@pages/community/MyCommunityStories';
import ReporterPortal from '@pages/community/ReporterPortal';
import CommunityHome from '@pages/community/CommunityHome';
import ReporterContactDirectory from '@pages/community/ReporterContactDirectory';
import YouthPulseContributorDirectory from '@pages/community/YouthPulseContributorDirectory';
import ReporterStoriesAdmin from '@pages/community/ReporterStoriesAdmin';
import JournalistApplications from '@pages/community/JournalistApplications';
import ReporterPortalPreview from '@pages/community/ReporterPortalPreview';
import GlobalCommandPalette from '@components/GlobalCommandPalette';
import EnvTest from '@components/EnvTest';
import NotFound from '@pages/NotFound';
import Denied from '@pages/Denied';
import MediaKitPublic from '@pages/MediaKitPublic';
import ViralVideosArchivePage from '@pages/ViralVideosArchivePage';
// Settings Center (admin)
import SettingsCenterLayout from '@pages/admin/settings/SettingsCenterLayout';
import AdminPanelSettingsLayout from '@pages/admin/settings/AdminPanelSettingsLayout';
import PublicSiteSettingsLayout from '@pages/admin/settings/PublicSiteSettingsLayout';
import TeamManagement from '@pages/admin/settings/admin-panel/TeamManagement';
import StaffActivityAttendance from '@pages/admin/settings/admin-panel/StaffActivityAttendance';
import SecurityAdmin from '@pages/admin/settings/admin-panel/SecurityAdmin';
import TranslationSettings from '@pages/admin/settings/admin-panel/TranslationSettings';
import TranslationGlossary from '@pages/admin/settings/admin-panel/TranslationGlossary';
import AuditLogsView from '@pages/admin/settings/admin-panel/AuditLogsView';
import AdminPreview from '@pages/admin/settings/admin-panel/AdminPreview';
import HomepageModulesSettings from '@pages/admin/settings/public-site/HomepageModulesSettings';
import TickersSettings from '@pages/admin/settings/public-site/TickersSettings';
import LiveTvSettings from '@pages/admin/settings/public-site/LiveTvSettings';
import InspirationHubSettings from '@pages/admin/settings/public-site/InspirationHubSettings';
import DailyWondersSettings from '@pages/admin/settings/public-site/DailyWondersSettings';
import FooterSettings from '@pages/admin/settings/public-site/FooterSettings';
import LanguageThemeSettings from '@pages/admin/settings/public-site/LanguageThemeSettings';
import PublicPreview from '@pages/admin/settings/public-site/PublicPreview';
import PanelRouter from '@/routes/PanelRouter';
import LegacyArticleEditRedirect from '@/routes/LegacyArticleEditRedirect';
// UnifiedLogin deprecated in favor of SimpleLogin for a single flow
import SimpleLogin from '@pages/auth/SimpleLogin';
import { RequireRole } from '@/routes/guards';
import SafeOwnerZoneShell from '@/pages/admin/safe-owner-zone/SafeOwnerZoneShell';
import SafeOwnerZoneHub from '@/pages/admin/safe-owner-zone/SafeOwnerZoneHub';
import SafeOwnerZoneModule from '@/pages/admin/safe-owner-zone/SafeOwnerZoneModule';
import SafeOwnerZoneAiModelLog from '@/pages/admin/safe-owner-zone/SafeOwnerZoneAiModelLog';
import BroadcastCenter from '@pages/admin/BroadcastCenter';
import AdminUsersPage from '@pages/AdminUsersPage';
import AiLogsPage from '@pages/AiLogsPage';
import ViralVideosPage from '@pages/admin/ViralVideosPage';
import { translationUiEnabled } from '@/config/featureFlags';

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

function LegacyCommunityReporterQueueRedirect() {
  const location = useLocation();
  return <Navigate to={`/community/reporter${location.search || ''}`} replace />;
}

function LegacyCommunityReporterQueueDetailRedirect() {
  const { id } = useParams();
  const location = useLocation();
  const safeId = encodeURIComponent(String(id || ''));
  return <Navigate to={`/admin/community-reporter/${safeId}${location.search || ''}`} replace />;
}

function CommunitySubmitRedirect() {
  useEffect(() => {
    const target = (import.meta.env.VITE_PUBLIC_REPORTER_PORTAL_URL || 'https://newspulse.co.in/community-reporter').toString().trim();
    if (target) {
      window.location.replace(target);
    }
  }, []);

  return null;
}

function App() {
  if (import.meta.env.DEV) console.log('Router loaded: main admin router');
  const { isDark } = useDarkMode();
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const isAuthPage = ['/login', '/admin/login', '/employee/login'].includes(location.pathname);
  const showTranslationUi = translationUiEnabled();
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
          {isAuthenticated && !isAuthPage ? <OwnerBar /> : null}
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
              <Route path="/media-kit" element={<MediaKitPublic />} />
              <Route path="/viral-videos" element={<ViralVideosArchivePage />} />
              <Route path="/viral-videos/:slug" element={<ViralVideosArchivePage />} />
              {/* New role-based panel (founder/admin/employee) */}
              <Route path="/panel/*" element={<PanelRouter />} />

              {/* 🔐 Admin Protected Routes */}
              {/* Legacy /add now redirects to /admin/add-news (updated editor) */}
              <Route path="/add" element={<AdminModuleRoute moduleKey="add_news"><AddNews /></AdminModuleRoute>} />
              <Route path="/edit/:id" element={<ProtectedRoute><LockCheckWrapper><EditNews /></LockCheckWrapper></ProtectedRoute>} />
              {/* New dedicated modern edit route using ArticleForm */}
              <Route path="/admin/articles/:id/edit" element={<ProtectedRoute><LockCheckWrapper><ArticleEditPage /></LockCheckWrapper></ProtectedRoute>} />
              {/* Legacy edit URLs (backward compatibility) */}
              <Route path="/admin/manage-news/:id/edit" element={<ProtectedRoute><LockCheckWrapper><LegacyArticleEditRedirect /></LockCheckWrapper></ProtectedRoute>} />
              <Route path="/manage-news/:id/edit" element={<ProtectedRoute><LockCheckWrapper><LegacyArticleEditRedirect /></LockCheckWrapper></ProtectedRoute>} />
              <Route path="/admin/news/:id/edit" element={<ProtectedRoute><LockCheckWrapper><LegacyArticleEditRedirect /></LockCheckWrapper></ProtectedRoute>} />
              <Route path="/push-history" element={<ProtectedRoute><LockCheckWrapper><PushHistory /></LockCheckWrapper></ProtectedRoute>} />
              <Route path="/add-category" element={<ProtectedRoute><LockCheckWrapper><AddCategory /></LockCheckWrapper></ProtectedRoute>} />
              <Route
                path="/language-settings"
                element={
                  showTranslationUi
                    ? <ProtectedRoute><LockCheckWrapper><LanguageSettings /></LockCheckWrapper></ProtectedRoute>
                    : <Navigate to="/admin/dashboard" replace />
                }
              />
              <Route path="/poll-editor" element={<ProtectedRoute><LockCheckWrapper><PollEditor /></LockCheckWrapper></ProtectedRoute>} />
              <Route path="/poll-results" element={<ProtectedRoute><LockCheckWrapper><PollResultsChart /></LockCheckWrapper></ProtectedRoute>} />
              {/* Add News legacy redirect */}
              <Route path="/admin/add" element={<AdminModuleRoute moduleKey="add_news"><Navigate to="/add" replace /></AdminModuleRoute>} />
              <Route path="/admin/add-news" element={<AdminModuleRoute moduleKey="add_news"><AddNews /></AdminModuleRoute>} />
              {/* Manage News canonical route + redirects */}
              <Route path="/admin/articles" element={<AdminModuleRoute moduleKey="manage_news"><LockCheckWrapper><ManageNews /></LockCheckWrapper></AdminModuleRoute>} />
              <Route path="/admin/compliance-reports" element={<AdminModuleRoute moduleKey="compliance_reports"><LockCheckWrapper><ComplianceReportsPage /></LockCheckWrapper></AdminModuleRoute>} />
              <Route path="/admin/viral-videos" element={<AdminModuleRoute moduleKey="viral_videos"><LockCheckWrapper><ViralVideosPage /></LockCheckWrapper></AdminModuleRoute>} />
              <Route path="/admin/viral-videos/new" element={<AdminModuleRoute moduleKey="viral_videos"><LockCheckWrapper><ViralVideosPage /></LockCheckWrapper></AdminModuleRoute>} />
              <Route path="/admin/viral-videos/:id/edit" element={<AdminModuleRoute moduleKey="viral_videos"><LockCheckWrapper><ViralVideosPage /></LockCheckWrapper></AdminModuleRoute>} />
              <Route path="/manage-news" element={<Navigate to="/admin/articles" replace />} />
              <Route path="/admin/manage-news" element={<AdminModuleRoute moduleKey="manage_news"><Navigate to="/admin/articles" replace /></AdminModuleRoute>} />
              <Route path="/admin/news" element={<Navigate to="/admin/articles" replace />} />
              <Route path="/admin/manage" element={<Navigate to="/admin/articles" replace />} />

              {/* Ads Manager */}
              <Route path="/admin/ads" element={<AdminModuleRoute moduleKey="ads_manager"><LockCheckWrapper><AdsManager /></LockCheckWrapper></AdminModuleRoute>} />
              <Route path="/admin/ads-manager" element={<AdminModuleRoute moduleKey="ads_manager"><LockCheckWrapper><AdsManager /></LockCheckWrapper></AdminModuleRoute>} />
              <Route path="/admin/finance" element={<AdminModuleRoute moduleKey="finance_desk"><FinanceDesk /></AdminModuleRoute>} />
              <Route path="/admin/sponsored-content" element={<Navigate to="/admin/ads" replace />} />
              {/* Draft Desk */}
              <Route path="/draft-desk" element={<AdminModuleRoute moduleKey="draft_desk"><LockCheckWrapper><DraftDeskPage /></LockCheckWrapper></AdminModuleRoute>} />
              <Route path="/draft-desk/:id" element={<AdminModuleRoute moduleKey="draft_desk"><LockCheckWrapper><DraftWorkspacePage /></LockCheckWrapper></AdminModuleRoute>} />
              {/* Legacy Draft Desk routes */}
              <Route path="/admin/drafts" element={<Navigate to="/draft-desk" replace />} />
              <Route path="/admin/drafts/:id" element={<Navigate to="/draft-desk/:id" replace />} />

              {/* 📡 Broadcast Center (Founder-only) */}
              <Route path="/admin/draft-desk" element={<AdminModuleRoute moduleKey="draft_desk"><Navigate to="/draft-desk" replace /></AdminModuleRoute>} />

              {/* 📡 Broadcast Center */}
              <Route path="/admin/broadcast-center" element={<AdminModuleRoute moduleKey="broadcast_center"><BroadcastCenter /></AdminModuleRoute>} />
              <Route path="/broadcast-center" element={<Navigate to="/admin/broadcast-center" replace />} />

              {/* Community Reporter Queue & Detail */}
              <Route path="/admin/community-reporter" element={<ProtectedRoute><CommunityReporterPage /></ProtectedRoute>} />
              {/* New canonical community reporter queue route (founder/admin view) */}
              <Route path="/community/reporter" element={<AdminModuleRoute moduleKey="community_reporter_queue"><CommunityReporterPage /></AdminModuleRoute>} />
              <Route path="/admin/community-reporter-queue" element={<AdminModuleRoute moduleKey="community_reporter_queue"><CommunityReporterPage /></AdminModuleRoute>} />
              {/* Legacy/typo route kept for backward compatibility */}
              <Route path="/community/reporter-queue" element={<ProtectedRoute><LegacyCommunityReporterQueueRedirect /></ProtectedRoute>} />
              <Route path="/community/reporter-queue/:id" element={<ProtectedRoute><LegacyCommunityReporterQueueDetailRedirect /></ProtectedRoute>} />
              {/* Community Hub root */}
              <Route path="/community" element={<ProtectedRoute><LockCheckWrapper><CommunityHome /></LockCheckWrapper></ProtectedRoute>} />
              <Route path="/community/youth-pulse-queue" element={<Navigate to="/community/reporter" replace />} />
              <Route path="/community/youth-pulse" element={<Navigate to="/community/reporter" replace />} />
              <Route path="/community/youth-pulse-contributors" element={<ProtectedRoute><LockCheckWrapper><YouthPulseContributorDirectory /></LockCheckWrapper></ProtectedRoute>} />
              <Route path="/admin/community-reporter/:id" element={<ProtectedRoute><CommunityReporterDetailPage /></ProtectedRoute>} />
              {/* Community Reporter – Submit Story (admin + public alias) */}
              <Route path="/admin/community/submit" element={<ProtectedRoute><LockCheckWrapper><CommunitySubmitRedirect /></LockCheckWrapper></ProtectedRoute>} />
              <Route path="/community/submit" element={<ProtectedRoute><LockCheckWrapper><CommunitySubmitRedirect /></LockCheckWrapper></ProtectedRoute>} />
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
              <Route path="/admin/community/portal" element={<AdminModuleRoute moduleKey="reporter_portal_admin"><LockCheckWrapper><ReporterPortal /></LockCheckWrapper></AdminModuleRoute>} />
              <Route path="/admin/reporter-portal-admin" element={<AdminModuleRoute moduleKey="reporter_portal_admin"><LockCheckWrapper><ReporterPortal /></LockCheckWrapper></AdminModuleRoute>} />
              <Route path="/community/portal" element={<AdminModuleRoute moduleKey="reporter_portal_admin"><LockCheckWrapper><ReporterPortal /></LockCheckWrapper></AdminModuleRoute>} />
              {/* Internal founder-only Reporter Portal preview */}
              <Route path="/community/reporter-portal" element={<FounderRoute><ReporterPortalPreview /></FounderRoute>} />
              {/* AI Test route removed in favor of the new AI Engine */}
              <Route path="/test-push" element={<ProtectedRoute><LockCheckWrapper><TestNotification /></LockCheckWrapper></ProtectedRoute>} />
              <Route path="/saved-news" element={<ProtectedRoute><LockCheckWrapper><SavedNews /></LockCheckWrapper></ProtectedRoute>} />
              <Route path="/poll" element={<ProtectedRoute><LockCheckWrapper><PollOfTheDay /></LockCheckWrapper></ProtectedRoute>} />
              <Route path="/admin/locked" element={<LockedPage />} />

              {/* 🛡️ Founder-Only Routes */}
              <Route path="/admin/dashboard" element={<AdminModuleRoute moduleKey="dashboard"><Dashboard /></AdminModuleRoute>} />

              {/* Admin tools (Founder/Admin only) */}
              <Route
                path="/admin/users"
                element={
                  <RequireRole allow={['founder', 'admin']}>
                    <AdminUsersPage />
                  </RequireRole>
                }
              />
              <Route
                path="/admin/ai-logs"
                element={
                  <RequireRole allow={['founder', 'admin']}>
                    <AiLogsPage />
                  </RequireRole>
                }
              />

              {/* Legacy/mismatched paths: keep working (avoid 404s) */}
              <Route path="/admin-users" element={<Navigate to="/admin/users" replace />} />
              <Route path="/ai-logs" element={<Navigate to="/admin/ai-logs" replace />} />
              <Route path="/admin-ai-logs" element={<Navigate to="/admin/ai-logs" replace />} />
              <Route path="/admin-dashboard" element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="/admin-settings" element={<Navigate to="/admin/settings" replace />} />
              {/* Settings Center (two-mode) */}
              <Route
                path="/admin/settings"
                element={
                  <AdminModuleRoute moduleKey={['settings', 'team_management']}>
                    <SettingsCenterLayout />
                  </AdminModuleRoute>
                }
              >
                <Route index element={<Navigate to="admin-panel" replace />} />

                <Route path="admin-panel" element={<AdminPanelSettingsLayout />}>
                  <Route index element={<Navigate to="team" replace />} />
                  <Route path="team" element={<AdminModuleRoute moduleKey="team_management"><TeamManagement /></AdminModuleRoute>} />
                  <Route path="staff-activity-attendance" element={<AdminModuleRoute moduleKey="team_management"><StaffActivityAttendance /></AdminModuleRoute>} />
                  <Route path="security" element={<SecurityAdmin />} />
                  <Route path="translation" element={<TranslationSettings />} />
                  <Route path="translation-glossary" element={<TranslationGlossary />} />
                  <Route path="change-password" element={<ChangePassword />} />
                  <Route path="audit" element={<AuditLogsView />} />
                  <Route path="preview" element={<AdminPreview />} />
                </Route>

                <Route path="public-site" element={<FounderRoute><PublicSiteSettingsLayout /></FounderRoute>}>
                  <Route index element={<Navigate to="homepage" replace />} />
                  <Route path="homepage" element={<HomepageModulesSettings />} />
                  <Route path="tickers" element={<TickersSettings />} />
                  <Route path="live-tv" element={<LiveTvSettings />} />
                  <Route path="inspiration-hub" element={<InspirationHubSettings />} />
                  <Route path="daily-wonders" element={<DailyWondersSettings />} />
                  <Route path="footer" element={<FooterSettings />} />
                  <Route path="language-theme" element={<LanguageThemeSettings />} />
                  <Route path="preview" element={<PublicPreview />} />
                </Route>
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
                  <ProtectedRoute>
                    <LockCheckWrapper>
                      <AdminModuleRoute moduleKey="safe_zone">
                        <SafeOwnerZoneShell />
                      </AdminModuleRoute>
                    </LockCheckWrapper>
                  </ProtectedRoute>
                }
              >
                <Route index element={<SafeOwnerZoneHub />} />
                <Route path="security" element={<SafeOwnerZoneModule slug="security" />} />
                <Route path="emergency" element={<SafeOwnerZoneModule slug="emergency" />} />
                <Route path="ai-safety" element={<SafeOwnerZoneModule slug="ai-safety" />} />
                <Route path="backup" element={<SafeOwnerZoneModule slug="backup" />} />
                <Route path="system-health" element={<SafeOwnerZoneModule slug="system-health" />} />
                <Route path="audit-logs" element={<SafeOwnerZoneModule slug="audit-logs" />} />
                <Route path="founder" element={<SafeOwnerZoneModule slug="founder" />} />
                <Route path="security-lockdown" element={<SafeOwnerZoneModule slug="security-lockdown" />} />
                <Route path="compliance" element={<SafeOwnerZoneModule slug="compliance" />} />
                <Route path="ai-control" element={<SafeOwnerZoneModule slug="ai-control" />} />
                <Route path="ai-model-log" element={<SafeOwnerZoneAiModelLog />} />
                <Route path="vaults" element={<SafeOwnerZoneModule slug="vaults" />} />
                <Route path="operations" element={<SafeOwnerZoneModule slug="operations" />} />
                <Route path="revenue" element={<SafeOwnerZoneModule slug="revenue" />} />
                <Route path="admin-oversight" element={<SafeOwnerZoneModule slug="admin-oversight" />} />
              </Route>

              <Route path="/safe-owner/settings" element={<FounderRoute><AdminControlCenter /></FounderRoute>} />
              <Route
                path="/safe-owner/language-settings"
                element={
                  showTranslationUi
                    ? <FounderRoute><LanguageManager /></FounderRoute>
                    : <Navigate to="/admin/dashboard" replace />
                }
              />
              <Route path="/safe-owner/panel-guide" element={<FounderRoute><PanelGuide /></FounderRoute>} />
              <Route path="/safe-owner/update-pin" element={<FounderRoute><UpdateFounderPIN /></FounderRoute>} />
              <Route path="/admin/live-feed-manager" element={<FounderRoute><LiveFeedManager /></FounderRoute>} />
              <Route path="/admin/embed-manager" element={<FounderRoute><EmbedManager /></FounderRoute>} />
              {/* Live TV */}
              <Route path="/admin/live" element={<AdminModuleRoute moduleKey="live_tv"><LiveTVControl /></AdminModuleRoute>} />
              <Route path="/admin/live-tv" element={<AdminModuleRoute moduleKey="live_tv"><LiveTVControl /></AdminModuleRoute>} />
              <Route path="/admin/toggle-controls" element={<FounderRoute><ToggleControls /></FounderRoute>} />
              <Route path="/admin/control-constitution" element={<FounderRoute><ControlConstitution /></FounderRoute>} />
              <Route path="/admin/diagnostics" element={<FounderRoute><Diagnostics /></FounderRoute>} />
              <Route path="/admin/ai-engine" element={<AdminModuleRoute moduleKey="ai_engine"><AIEngine /></AdminModuleRoute>} />
              <Route path="/admin/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
              <Route path="/admin/aira" element={<AdminModuleRoute moduleKey="aira"><Aira /></AdminModuleRoute>} />
              <Route path="/admin/youth-pulse" element={<ProtectedRoute><YouthPulse /></ProtectedRoute>} />
              <Route path="/admin/editorial" element={<AdminModuleRoute moduleKey="editorial"><Editorial /></AdminModuleRoute>} />

              {/* Legacy Safe Owner Zone v5 routes: redirect to canonical /admin/safe-owner-zone */}
              <Route path="/safeownerzone" element={<Navigate to="/admin/safe-owner-zone" replace />} />
              <Route path="/safeownerzone/:module" element={<LegacySafeOwnerZoneRedirect />} />

              {/* 🚀 Advanced Modules */}
              <Route path="/admin/ai-assistant" element={<ProtectedRoute><AIEditorialAssistant /></ProtectedRoute>} />
              <Route
                path="/admin/review-queue"
                element={
                  showTranslationUi
                    ? <ProtectedRoute><EditorialWorkflowEngine /></ProtectedRoute>
                    : <Navigate to="/admin/dashboard" replace />
                }
              />
              <Route
                path="/admin/workflow"
                element={
                  showTranslationUi
                    ? <Navigate to="/admin/review-queue" replace />
                    : <Navigate to="/admin/dashboard" replace />
                }
              />
              <Route path="/admin/media" element={<AdminModuleRoute moduleKey="media"><Navigate to="/admin/media-library" replace /></AdminModuleRoute>} />
              <Route path="/admin/media-library" element={<AdminModuleRoute moduleKey="media"><MediaLibrary /></AdminModuleRoute>} />
              {/* Readership analytics (real backend /api/admin/analytics/*) */}
              <Route path="/admin/analytics/articles" element={<AdminModuleRoute moduleKey="analytics"><ArticlesAnalyticsPage /></AdminModuleRoute>} />
              <Route path="/admin/analytics/categories" element={<AdminModuleRoute moduleKey="analytics"><CategoriesAnalyticsPage /></AdminModuleRoute>} />
              <Route path="/admin/analytics" element={<AdminModuleRoute moduleKey="analytics"><AnalyticsDashboard /></AdminModuleRoute>} />
              <Route path="/admin/security" element={<FounderRoute><EnhancedSecurityDashboard /></FounderRoute>} />
              <Route path="/admin/web-stories" element={<ProtectedRoute><WebStoriesEditor /></ProtectedRoute>} />
              <Route path="/admin/moderation" element={<AdminModuleRoute moduleKey="moderation"><CommentModerationDashboard /></AdminModuleRoute>} />
              <Route path="/admin/seo" element={<AdminModuleRoute moduleKey="seo"><SEOToolsDashboard /></AdminModuleRoute>} />
              <Route path="/admin/founder-control" element={<FounderRoute><FounderControlCenter /></FounderRoute>} />
              {/* New Founder Control route alias */}
              <Route path="/admin/founder" element={<FounderRoute><FounderControlPage /></FounderRoute>} />


              {/* 🔐 Login + Fallback */}
              {/* Keep only one login system (NewsPulse React login) */}
              <Route path="/auth" element={<Navigate to="/login" replace />} />
              <Route path="/auth/unified" element={<Navigate to="/login" replace />} />
              <Route path="/auth/simple" element={<SimpleLogin />} />
              {/* Canonical public login */}
              <Route path="/login" element={<SimpleLogin />} />
              {/* Back-compat alias */}
              <Route path="/admin/login" element={<Navigate to="/login" replace />} />
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

