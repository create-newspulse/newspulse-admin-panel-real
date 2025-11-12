import { Routes, Route, Navigate } from 'react-router-dom';
import AppShell from '@/components/layout/AppShell';
import { RequireAuth, RequireRole } from '@/routes/guards';
import QuickCards from '@/components/dashboard/QuickCards';
import SystemAlerts from '@/components/alerts/SystemAlerts';

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
          <Route path="founder/command" element={<RequireRole allow={['founder']}><Page title="Founder Command" /></RequireRole>} />
          <Route path="founder/security" element={<RequireRole allow={['founder']}><Page title="Security & Lockdown" /></RequireRole>} />
          <Route path="founder/vaults" element={<RequireRole allow={['founder']}><Page title="Vaults" /></RequireRole>} />
          <Route path="founder/ai-control" element={<RequireRole allow={['founder']}><Page title="AI Control" /></RequireRole>} />
          <Route path="founder/analytics-revenue" element={<RequireRole allow={['founder']}><Page title="Analytics & Revenue" /></RequireRole>} />
          <Route path="founder/logs" element={<RequireRole allow={['founder']}><Page title="Founder Logs" /></RequireRole>} />
          <Route path="founder/system-intel" element={<RequireRole allow={['founder']}><Page title="System Intelligence Panel" /></RequireRole>} />

          {/* Admin */}
          <Route path="admin/news/new" element={<RequireRole allow={['founder','admin']}><Page title="Add News" /></RequireRole>} />
          <Route path="admin/news" element={<RequireRole allow={['founder','admin']}><Page title="Manage News" /></RequireRole>} />
          <Route path="admin/moderation" element={<RequireRole allow={['founder','admin']}><Page title="Moderation" /></RequireRole>} />
          <Route path="admin/compliance" element={<RequireRole allow={['founder','admin']}><Page title="Compliance" /></RequireRole>} />
          <Route path="admin/operations" element={<RequireRole allow={['founder','admin']}><Page title="Operations" /></RequireRole>} />
          <Route path="admin/editorial-media" element={<RequireRole allow={['founder','admin']}><Page title="Editorial & Media" /></RequireRole>} />
          <Route path="admin/workflow" element={<RequireRole allow={['founder','admin']}><Page title="Workflow" /></RequireRole>} />

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
