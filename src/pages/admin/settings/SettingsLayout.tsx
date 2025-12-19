import { Link, useSearchParams } from 'react-router-dom';
import { useMemo, useState, useEffect } from 'react';
import SettingsWorkspacePlaceholder from '@/components/settings/SettingsWorkspacePlaceholder';
import { SETTINGS_SECTIONS } from '@/features/settings/settingsRegistry';

export default function SettingsLayout() {
  const [searchParams, setSearchParams] = useSearchParams();
  const REGISTRY = useMemo(() => [...SETTINGS_SECTIONS].sort((a, b) => a.order - b.order), []);
  const STORAGE_KEY = 'np_admin_settings_tab';

  const initialKey = useMemo(() => {
    const fromUrl = searchParams.get('tab');
    if (fromUrl && REGISTRY.some(s => s.key === fromUrl)) return fromUrl;
    const fromStorage = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (fromStorage && REGISTRY.some(s => s.key === fromStorage)) return fromStorage;
    return REGISTRY[0]?.key || 'overview';
  }, [searchParams, REGISTRY]);

  const [activeKey, setActiveKey] = useState<string>(initialKey);

  useEffect(() => {
    // Keep URL and storage in sync when activeKey changes
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', activeKey);
      return next;
    }, { replace: true });
    try { localStorage.setItem(STORAGE_KEY, activeKey); } catch {}
  }, [activeKey, setSearchParams]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {/* Header */}
      <div className="md:col-span-4 flex items-center justify-between">
        <div>
          <nav className="text-sm text-slate-500">
            <Link to="/" className="hover:text-slate-700">Home</Link>
            <span className="mx-2">›</span>
            <span className="text-slate-700 font-medium">Settings</span>
          </nav>
          <h1 className="mt-2 text-2xl font-semibold">Admin Settings</h1>
        </div>
      </div>

      {/* Sidebar */}
      <aside className="md:col-span-1 space-y-2">
        {REGISTRY.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveKey(s.key)}
            className={`w-full text-left px-3 py-2 rounded border ${activeKey === s.key ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}
          >
            {s.label}
          </button>
        ))}
      </aside>

      {/* Content */}
      <section className="md:col-span-3 space-y-3">
        <div className="rounded border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 p-4">
          <h2 className="text-base font-semibold">{REGISTRY.find(s => s.key === activeKey)?.label || 'Overview'}</h2>
        </div>
        <SettingsWorkspacePlaceholder />
      </section>
    </div>
  );
}
// Shell-only settings layout; section content deferred for future rearrangement.
