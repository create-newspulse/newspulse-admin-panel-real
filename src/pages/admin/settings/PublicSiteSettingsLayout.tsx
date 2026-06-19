import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@context/AuthContext';
import { PublicSiteSettingsDraftProvider, usePublicSiteSettingsDraft } from '@/features/settings/PublicSiteSettingsDraftContext';
import StickyActionBar from '@/components/settings/StickyActionBar';
import { toast } from 'react-hot-toast';
import { normalizeError } from '@/lib/error';

const linkCls = ({ isActive }: { isActive: boolean }) =>
  `block w-full rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition ` +
  (isActive ? 'border-blue-300 bg-blue-50 text-blue-700 shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50');

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
  const { dirty, resetDraftRemoteToPublished, saveDraftRemote, publish, status } = usePublicSiteSettingsDraft();
  const location = useLocation();

  const busy = status === 'publishing' || status === 'saving' || status === 'loading';
  const previewTo = location.pathname.includes('/admin/settings/public-site/preview') ? undefined : 'preview';

  const handleReset = async () => {
    try {
      await resetDraftRemoteToPublished('reset-public-site-settings-to-published');
      toast.success('Saved to live. Public site will update automatically.');
    } catch (e: unknown) {
      toast.error(normalizeError(e as any, 'Reset failed').message);
    }
  };

  const handleSaveDraft = async () => {
    try {
      await saveDraftRemote('save-public-site-settings');
      toast.success('Saved to live. Public site will update automatically.');
    } catch (e: unknown) {
      toast.error(normalizeError(e as any, 'Save failed').message);
    }
  };

  const handlePublish = async () => {
    try {
      await publish('publish-public-site-settings');
      toast.success('Published to LIVE instantly.');
    } catch (e: unknown) {
      toast.error(normalizeError(e as any, 'Publish failed').message);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 pb-32 lg:grid-cols-12">
      <aside className="space-y-3 lg:col-span-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold text-slate-950">Public Site Settings</div>
          <div className="mt-1 text-xs leading-5 text-slate-500">Homepage, tickers, live TV, footer, language, and theme sections.</div>
        </div>
        <NavLink to="homepage" className={linkCls}>Homepage Modules</NavLink>
        <NavLink to="tickers" className={linkCls}>Tickers</NavLink>
        <NavLink to="live-tv" className={linkCls}>Live TV</NavLink>
        <NavLink to="inspiration-hub" className={linkCls}>Inspiration Hub</NavLink>
        <NavLink to="daily-wonders" className={linkCls}>Daily Wonders</NavLink>
        <NavLink to="footer" className={linkCls}>Footer</NavLink>
        <NavLink to="language-theme" className={linkCls}>Language & Theme</NavLink>
      </aside>

      <section className="min-w-0 space-y-5 lg:col-span-9">
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
