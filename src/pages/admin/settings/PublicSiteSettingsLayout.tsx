import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@context/AuthContext';
import { PublicSiteSettingsDraftProvider, usePublicSiteSettingsDraft } from '@/features/settings/PublicSiteSettingsDraftContext';
import StickyActionBar from '@/components/settings/StickyActionBar';
import { toast } from 'react-hot-toast';
import { normalizeError } from '@/lib/error';

const linkCls = ({ isActive }: { isActive: boolean }) =>
  `block w-full text-left px-3 py-2 rounded-lg border text-sm ` +
  (isActive ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-slate-50 border-slate-200 hover:bg-slate-100');

export default function PublicSiteSettingsLayout() {
  return (
    <PublicSiteSettingsDraftProvider>
      <PublicSiteSettingsLayoutInner />
    </PublicSiteSettingsDraftProvider>
  );
}

function PublicSiteSettingsLayoutInner() {
  const { user } = useAuth();
  const canPublish = String(user?.role || '').toLowerCase() === 'founder';
  const { dirty, resetDraftToPublished, saveDraftRemote, publish, status } = usePublicSiteSettingsDraft();
  const location = useLocation();

  const busy = status === 'publishing' || status === 'saving' || status === 'loading';
  const previewTo = location.pathname.includes('/admin/settings/public-site/preview') ? undefined : 'preview';

  const handleReset = () => {
    resetDraftToPublished();
    toast('Reset to last published');
  };

  const handleSaveDraft = async () => {
    try {
      await saveDraftRemote('save-public-site-settings');
      toast.success('Saved');
    } catch (e: unknown) {
      toast.error(normalizeError(e as any, 'Save failed').message);
    }
  };

  const handlePublish = async () => {
    try {
      await publish('publish-public-site-settings');
      toast.success('Published');
    } catch (e: unknown) {
      toast.error(normalizeError(e as any, 'Publish failed').message);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pb-20">
      <aside className="md:col-span-1 space-y-2">
        <NavLink to="homepage" className={linkCls}>Homepage Modules</NavLink>
        <NavLink to="tickers" className={linkCls}>Tickers</NavLink>
        <NavLink to="live-tv" className={linkCls}>Live TV</NavLink>
        <NavLink to="footer" className={linkCls}>Footer</NavLink>
        <NavLink to="language-theme" className={linkCls}>Language & Theme</NavLink>
      </aside>

      <section className="md:col-span-3 space-y-4">
        <Outlet />
      </section>

      <StickyActionBar
        dirty={dirty}
        canPublish={canPublish}
        busy={busy}
        previewTo={previewTo}
        onReset={handleReset}
        onSaveDraft={handleSaveDraft}
        onPublish={handlePublish}
      />
    </div>
  );
}
