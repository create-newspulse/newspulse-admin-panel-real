import { Routes, Route, Navigate } from 'react-router-dom';
import AppShell from '@/components/layout/AppShell';
import { RequireAuth, RequireRole } from '@/routes/guards';
import QuickCards from '@/components/dashboard/QuickCards';
import SystemAlerts from '@/components/alerts/SystemAlerts';
import DraftDeskPage from '@/pages/admin/DraftDeskPage';
import FeatureTogglesCommunityReporter from '@/pages/founder/FeatureTogglesCommunityReporter';
import ReporterPortalPreview from '@/pages/founder/ReporterPortalPreview';
import SiteControls from '@/pages/SiteControls';
import EditorialWorkflowEngine from '@/components/advanced/EditorialWorkflowEngine';

// Placeholder pages
function Page({ title }: { title: string }) { return <div className="space-y-4"><h1 className="text-2xl font-semibold">{title}</h1><p className="opacity-70 text-sm">TODO: implement "{title}"</p></div>; }

export default function PanelRouter() {
  return (
    <RequireAuth>
      <AppShell>
        <Routes>
          {/* Dashboard */}
          <Route path="" element={<><QuickCards /><div className="mt-6"><SystemAlerts /></div></>} />

          {/* Founder */}
          <Route path="founder/command" element={<RequireRole allow={['founder']}><Navigate to="/admin/safe-owner-zone/founder" replace /></RequireRole>} />
          <Route path="founder/security" element={<RequireRole allow={['founder']}><Navigate to="/admin/safe-owner-zone/security-lockdown" replace /></RequireRole>} />
          <Route path="founder/compliance" element={<RequireRole allow={['founder']}><Navigate to="/admin/safe-owner-zone/compliance" replace /></RequireRole>} />
          <Route path="founder/vaults" element={<RequireRole allow={['founder']}><Navigate to="/admin/safe-owner-zone/vaults" replace /></RequireRole>} />
          <Route path="founder/ai-control" element={<RequireRole allow={['founder']}><Navigate to="/admin/safe-owner-zone/ai-control" replace /></RequireRole>} />
          <Route path="founder/ops" element={<RequireRole allow={['founder']}><Navigate to="/admin/safe-owner-zone/operations" replace /></RequireRole>} />
          <Route path="founder/admin" element={<RequireRole allow={['founder']}><Navigate to="/admin/safe-owner-zone/admin-oversight" replace /></RequireRole>} />
          <Route path="founder/feature-toggles" element={<RequireRole allow={['founder']}><FeatureTogglesCommunityReporter /></RequireRole>} />
          <Route path="founder/site-controls" element={<RequireRole allow={['founder']}><SiteControls /></RequireRole>} />
          <Route path="founder/reporter-portal" element={<RequireRole allow={['founder','admin']}><ReporterPortalPreview /></RequireRole>} />
          <Route path="founder/analytics-revenue" element={<RequireRole allow={['founder']}><Navigate to="/admin/safe-owner-zone/revenue" replace /></RequireRole>} />
          <Route path="founder/logs" element={<RequireRole allow={['founder']}><Page title="Founder Logs" /></RequireRole>} />
          <Route path="founder/system-intel" element={<RequireRole allow={['founder']}><Page title="System Intelligence Panel" /></RequireRole>} />

          {/* Admin */}
          <Route path="admin/news/new" element={<RequireRole allow={['founder','admin']}><Page title="Add News" /></RequireRole>} />
          <Route path="admin/news" element={<RequireRole allow={['founder','admin']}><Page title="Manage News" /></RequireRole>} />
          <Route path="admin/drafts" element={<RequireRole allow={['founder','admin','editor']}><DraftDeskPage /></RequireRole>} />
          <Route path="admin/moderation" element={<RequireRole allow={['founder','admin']}><Page title="Moderation" /></RequireRole>} />
          <Route path="admin/compliance" element={<RequireRole allow={['founder','admin']}><Page title="Compliance" /></RequireRole>} />
          <Route path="admin/operations" element={<RequireRole allow={['founder','admin']}><Page title="Operations" /></RequireRole>} />
          <Route path="admin/editorial-media" element={<RequireRole allow={['founder','admin']}><Page title="Editorial & Media" /></RequireRole>} />
          <Route path="admin/review-queue" element={<RequireRole allow={['founder','admin']}><EditorialWorkflowEngine /></RequireRole>} />
          <Route path="admin/workflow" element={<RequireRole allow={['founder','admin']}><Navigate to="/admin/review-queue" replace /></RequireRole>} />

          {/* Employee */}
          <Route path="employee/news/new" element={<RequireRole allow={['founder','admin','employee']}><Page title="Add News (Restricted)" /></RequireRole>} />
          <Route path="employee/drafts" element={<RequireRole allow={['founder','admin','employee']}><Page title="Draft Box" /></RequireRole>} />
          <Route path="employee/assistant" element={<RequireRole allow={['founder','admin','employee']}><Page title="AI Assistant Tip Box" /></RequireRole>} />
          <Route path="employee/tools" element={<RequireRole allow={['founder','admin','employee']}><Page title="Grammar & Dictionary" /></RequireRole>} />

          {/* Default */}
          <Route path="*" element={<Navigate to="/panel" replace />} />
        </Routes>
      </AppShell>
    </RequireAuth>
  );
}
