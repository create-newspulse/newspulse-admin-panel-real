import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@context/AuthContext';
import { useSettingsDraft } from '@/features/settings/SettingsDraftContext';
import StickyActionBar from '@/components/settings/StickyActionBar';
import { toast } from 'react-hot-toast';

const linkCls = ({ isActive }: { isActive: boolean }) =>
  `block w-full text-left px-3 py-2 rounded-lg border text-sm ` +
  (isActive ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-slate-50 border-slate-200 hover:bg-slate-100');

export default function AdminPanelSettingsLayout() {
  const { user } = useAuth();
  const canPublish = String(user?.role || '').toLowerCase() === 'founder';
  const { dirty, resetDraft, saveDraftLocal, publish, status } = useSettingsDraft();
  const location = useLocation();

  const busy = status === 'publishing' || status === 'saving' || status === 'loading';
  const previewTo = location.pathname.includes('/admin/settings/admin-panel/preview') ? undefined : 'preview';
  const isChangePassword = location.pathname.startsWith('/admin/settings/admin-panel/change-password');

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pb-20">
      <aside className="md:col-span-1 space-y-2">
        <NavLink to="team" className={linkCls}>Team Management</NavLink>
        <NavLink to="security" className={linkCls}>Security</NavLink>
        <NavLink to="change-password" className={linkCls}>Change Password</NavLink>
        <NavLink to="audit" className={linkCls}>Audit Logs</NavLink>
        <NavLink to="preview" className={linkCls}>Preview</NavLink>
      </aside>

      <section className="md:col-span-3 space-y-4">
        <Outlet />
      </section>

      {!isChangePassword && (
        <StickyActionBar
          dirty={dirty}
          canPublish={canPublish}
          busy={busy}
          previewTo={previewTo}
          onReset={() => {
            resetDraft();
            toast('Reset to last published');
          }}
          onSaveDraft={() => {
            saveDraftLocal();
            toast.success('Draft saved');
          }}
          onPublish={async () => {
            try {
              await publish('publish-admin-panel-settings');
              toast.success('Published');
            } catch (e: any) {
              toast.error(e?.message || 'Publish failed');
            }
          }}
        />
      )}
    </div>
  );
}
