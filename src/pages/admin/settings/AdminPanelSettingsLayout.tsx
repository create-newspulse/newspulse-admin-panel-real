import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@context/AuthContext';
import { SettingsDraftProvider, useSettingsDraft } from '@/features/settings/SettingsDraftContext';
import StickyActionBar from '@/components/settings/StickyActionBar';
import { toast } from 'react-hot-toast';
import { normalizeError } from '@/lib/error';

const linkCls = ({ isActive }: { isActive: boolean }) =>
  `block w-full rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition ` +
  (isActive ? 'border-blue-300 bg-blue-50 text-blue-700 shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50');

export default function AdminPanelSettingsLayout() {
  return (
    <SettingsDraftProvider scope="admin-panel">
      <AdminPanelSettingsLayoutInner />
    </SettingsDraftProvider>
  );
}

function AdminPanelSettingsLayoutInner() {
  const { user } = useAuth();
  const canPublish = String(user?.role || '').toLowerCase() === 'founder';
  const { dirty, resetDraft, saveDraftLocal, publish, status } = useSettingsDraft();
  const location = useLocation();

  const busy = status === 'publishing' || status === 'saving' || status === 'loading';
  const previewTo = location.pathname.includes('/admin/settings/admin-panel/preview') ? undefined : 'preview';
  const isChangePassword = location.pathname.startsWith('/admin/settings/admin-panel/change-password');

  const handleReset = () => {
    resetDraft();
    toast('Reset to last published');
  };

  const handleSaveDraft = () => {
    saveDraftLocal();
    toast.success('Draft saved');
  };

  const handlePublish = async () => {
    try {
      await publish('publish-admin-panel-settings');
      toast.success('Published');
    } catch (e: unknown) {
      toast.error(normalizeError(e as any, 'Publish failed').message);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 pb-32 lg:grid-cols-12">
      <aside className="space-y-3 lg:col-span-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold text-slate-950">Admin Panel Settings</div>
          <div className="mt-1 text-xs leading-5 text-slate-500">Team, security, translation, audit, and preview controls.</div>
        </div>
        <NavLink to="team" className={linkCls}>Team Management</NavLink>
        <NavLink to="staff-activity-attendance" className={linkCls}>Staff Activity &amp; Attendance</NavLink>
        <NavLink to="security" className={linkCls}>Security</NavLink>
        {canPublish ? <NavLink to="translation" className={linkCls}>Translation</NavLink> : null}
        {canPublish ? <NavLink to="translation-glossary" className={linkCls}>Glossary / Protected Terms</NavLink> : null}
        <NavLink to="change-password" className={linkCls}>Change Password</NavLink>
        <NavLink to="audit" className={linkCls}>Audit Logs</NavLink>
        <NavLink to="preview" className={linkCls}>Preview</NavLink>
      </aside>

      <section className="min-w-0 space-y-5 lg:col-span-9">
        <Outlet />
      </section>

      {!isChangePassword && (
        <StickyActionBar
          dirty={dirty}
          canPublish={canPublish}
          busy={busy}
          previewTo={previewTo}
          onReset={handleReset}
          onSaveDraft={handleSaveDraft}
          onPublish={handlePublish}
        />
      )}
    </div>
  );
}
