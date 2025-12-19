import { useEffect, useMemo, useState } from 'react';
import { settingsApi } from '@/lib/settingsApi';
import { SETTINGS_REGISTRY, getValue, setValue } from '@/lib/settingsRegistry';
import type { SiteSettings } from '@/types/siteSettings';
import StickySettingsBar from '@/components/settings/StickySettingsBar';
import ScopeBadge from '@/components/settings/ScopeBadge';

export default function SettingsHome() {
  const [base, setBase] = useState<SiteSettings | null>(null);
  const [local, setLocal] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const dirty = useMemo(() => JSON.stringify(local) !== JSON.stringify(base), [local, base]);

  useEffect(() => {
    const did = (window as any).__np_settings_didFetch ?? ((window as any).__np_settings_didFetch = { value: false });
    if (did.value) return; // Fetch ONCE; no auto-retry loop
    did.value = true;
    let mounted = true;
    (async () => {
      try {
        const s = await settingsApi.getAdminSettings();
        if (!mounted) return;
        setBase(s);
        setLocal(s);
        setError(null);
      } catch (e: any) {
        if (!mounted) return;
        const msg = String(e?.message || '');
        const m = /HTTP\s+(\d+)/i.exec(msg);
        setError(m ? `Failed to load settings (HTTP ${m[1]}).` : 'Failed to load settings.');
      } finally { setLoading(false); }
    })();
    return () => { mounted = false; };
  }, []);

  const onSave = async () => {
    if (!local) return;
    setSaving(true);
    try {
      const next = await settingsApi.putAdminSettings(local, { action: 'save-settings' });
      setBase(next);
      setLocal(next);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to save settings.');
    } finally { setSaving(false); }
  };
  const onCancel = () => { if (base) setLocal(base); };

  const items = useMemo(() => {
    const query = q.trim().toLowerCase();
    return SETTINGS_REGISTRY.filter((i) => {
      if (!query) return true;
      return (
        i.label.toLowerCase().includes(query) ||
        (i.description || '').toLowerCase().includes(query) ||
        i.section.toLowerCase().includes(query) ||
        i.key.toLowerCase().includes(query)
      );
    });
  }, [q]);

  const grouped = useMemo(() => {
    const groups: Record<string, typeof items> = {};
    for (const it of items) {
      groups[it.section] = groups[it.section] || [];
      groups[it.section].push(it);
    }
    return groups;
  }, [items]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <input
            className="w-full border border-slate-300 rounded px-3 py-2"
            placeholder="Search settings…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {base && (
          <div className="text-sm text-slate-600">
            <div>Last updated: <span className="font-medium">{(() => { const u = base.updatedAt; const ok = u && !Number.isNaN(Date.parse(u)); return ok ? new Date(u).toLocaleString() : '—'; })()}</span></div>
            <div>Updated by: <span className="font-medium">{(base as any).updatedBy || 'system'}</span></div>
            <div>Version: <span className="font-medium">{base.version}</span></div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="p-4 rounded border border-slate-200 bg-white">Loading settings…</div>
      ) : error ? (
        <div className="p-4 rounded border border-red-200 bg-red-50 text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button
            className="text-sm px-2 py-1 rounded border border-red-300 hover:bg-red-100"
            onClick={() => {
              setLoading(true);
              setError(null);
              // re-run loader
              (async () => {
                try {
                  const s = await settingsApi.getAdminSettings();
                  setBase(s);
                  setLocal(s);
                  setError(null);
                } catch (e: any) {
                  const msg = String(e?.message || '');
                  const m = /HTTP\s+(\d+)/i.exec(msg);
                  setError(m ? `Failed to load settings (HTTP ${m[1]}).` : 'Failed to load settings.');
                } finally { setLoading(false); }
              })();
            }}
          >Retry</button>
        </div>
      ) : !local ? (
        <div className="p-4 rounded border border-slate-200 bg-white">No settings available.</div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([section, list]) => (
            <div key={section} className="p-4 rounded border border-slate-200 bg-white">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">{section}</h2>
                <button
                  className="text-sm px-2 py-1 rounded border border-slate-300 hover:bg-slate-100"
                  onClick={() => {
                    // Reset this section to defaults by reloading from base schema defaults
                    // Note: simplest approach is to pull defaults by saving an empty patch via schema safeParse
                    // For now, revert to server-provided base to avoid inconsistency
                    if (!base) return;
                    const next = { ...local } as SiteSettings;
                    for (const it of list) {
                      const def = getValue(base, it.key);
                      setValue(next, it.key, def);
                    }
                    setLocal(next);
                  }}
                >Reset section</button>
              </div>
              <div className="space-y-2">
                {list.map((it) => {
                  const val = getValue(local, it.key);
                  return (
                    <div key={it.key} className="flex items-center justify-between gap-4 py-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{it.label}</span>
                          <ScopeBadge scope={it.scope} />
                        </div>
                        {it.description && (
                          <div className="text-sm text-slate-600">{it.description}</div>
                        )}
                      </div>
                      <div className="w-64">
                        {it.control === 'toggle' && (
                          <label className="inline-flex items-center gap-2">
                            <input type="checkbox" checked={!!val} onChange={(e) => setLocal(setValue(local!, it.key, e.target.checked))} />
                            <span className="text-sm">{val ? 'On' : 'Off'}</span>
                          </label>
                        )}
                        {it.control === 'select' && (
                          <select className="border rounded px-2 py-1 w-full" value={String(val)} onChange={(e) => setLocal(setValue(local!, it.key, e.target.value))}>
                            {(it.options || []).map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        )}
                        {it.control === 'input' && (
                          <input className="border rounded px-2 py-1 w-full" value={Array.isArray(val) ? (val as string[]).join(',') : String(val || '')} onChange={(e) => {
                            const v = e.target.value;
                            const parsed = it.key.endsWith('languages') ? v.split(',').map((s) => s.trim()).filter(Boolean) : v;
                            setLocal(setValue(local!, it.key, parsed));
                          }} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <StickySettingsBar dirty={dirty} saving={saving} onSave={onSave} onCancel={onCancel} />
    </div>
  );
}
// Unified Settings Hub with search, grouped sections, scope badges, reset, and save/cancel
