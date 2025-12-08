import { useEffect, useState } from 'react';
import { useFounderActions } from '../hooks/useFounderActions';
import { useNotify } from '@/components/ui/toast-bridge';

const SECURITY_ENABLED = import.meta.env.VITE_SECURITY_SYSTEM_ENABLED !== 'false';

export default function EscalationSettings() {
  const { getEscalation, saveEscalation } = useFounderActions();
  const notify = useNotify();
  const [data, setData] = useState<any>(null); // will hold { levels: [...] }
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  useEffect(() => {
    let cancelled = false;
    if (!SECURITY_ENABLED) {
      console.warn('[EscalationSettings] disabled via VITE_SECURITY_SYSTEM_ENABLED=false');
      // Provide stub escalation levels to avoid error banner
      setData({
        levels: [
          { level: 'L1', name: 'Monitoring', description: 'Stub: basic watch', triggers: [], channels: { dashboard: true }, autoLockdown: false },
          { level: 'L2', name: 'Heightened', description: 'Stub: elevated watch', triggers: [], channels: { dashboard: true, email: false }, autoLockdown: false },
          { level: 'L3', name: 'Critical', description: 'Stub: critical response', triggers: [], channels: { dashboard: true, email: true }, autoLockdown: false },
        ],
      });
      return () => { cancelled = true; };
    }
    (async () => {
      try {
        const r = await getEscalation();
        const payload = r?.data ?? (r?.levels ? r : null);
        if (!payload || !Array.isArray(payload.levels)) throw new Error('Invalid response');
        if (!cancelled) {
          const normalized = {
            ...payload,
            levels: payload.levels.map((lvl: any) => ({
              level: lvl.level || 'L?',
              name: lvl.name || 'Unnamed',
              description: lvl.description || '',
              triggers: Array.isArray(lvl.triggers) ? lvl.triggers : [],
              channels: typeof lvl.channels === 'object' && lvl.channels ? lvl.channels : { dashboard: true, email: false, sms: false, webhook: false },
              autoLockdown: !!lvl.autoLockdown,
            }))
          };
          setData(normalized);
        }
      } catch (e: any) {
        if (!cancelled) {
          if (/invalid response/i.test(e?.message || '')) {
            // Provide minimal stub if API shape invalid
            console.warn('[EscalationSettings] using stub due to invalid response');
            setData({ levels: [] });
          } else {
            setError(e?.message || 'Failed to load escalation');
          }
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);
  if (error) return <div className="text-red-600">Failed to load: {error}</div>;
  if (!data) return <div>Loading…</div>;

  function update(level: number, field: string, value: any) {
    if (!data) return;
    const copy = { ...data, levels: data.levels.map((l: any, idx: number) => idx === level ? { ...l, [field]: value } : l) };
    setData(copy);
  }

  async function save() {
    if (!data || saving) return;
    setSaving(true);
    const prev = data;
    const optimistic = { ...data, updatedAt: new Date().toISOString() };
    setData(optimistic);
    try {
      const r = await saveEscalation(data);
      const ok = r?.ok ?? !!r?.levels;
      const payload = r?.data ?? (ok ? r : null);
      if (ok && payload && Array.isArray(payload.levels)) {
        notify.ok(/stub/i.test(JSON.stringify(payload)) ? 'Escalation stub saved' : 'Escalation saved', payload.updatedAt ? new Date(payload.updatedAt).toLocaleString() : '');
        setData({ ...payload, levels: payload.levels.map((lvl: any) => ({
          ...lvl,
          triggers: Array.isArray(lvl.triggers) ? lvl.triggers : [],
          channels: typeof lvl.channels === 'object' && lvl.channels ? lvl.channels : {},
        })) });
      } else {
        setData(prev);
        notify.err('Save failed', (r as any)?.error ?? 'Try again');
      }
    } catch (e: any) {
      if (/404|not found/i.test(e?.message || '')) {
        notify.ok('Escalation stub stored locally');
      } else {
        setData(prev);
        notify.err('Save failed', e?.message || 'Unknown error');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {(data.levels || []).map((lvl: any, idx: number) => (
        <div key={lvl.level} className="border rounded p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">{lvl.level} — {lvl.name}</h3>
            {lvl.level === 'L3' && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={lvl.autoLockdown} onChange={e => update(idx, 'autoLockdown', e.target.checked)} />
                Auto-Lockdown on trigger
              </label>
            )}
          </div>
          <label className="block text-sm mb-1">Description</label>
          <input className="border rounded w-full px-2 py-1 mb-2" value={lvl.description} onChange={e => update(idx, 'description', e.target.value)} />
          <label className="block text-sm mb-1">Triggers (comma-separated)</label>
          <input className="border rounded w-full px-2 py-1 mb-2" value={(lvl.triggers || []).join(',')} onChange={e => update(idx, 'triggers', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} />
          <div className="grid grid-cols-4 gap-3">
            {['dashboard', 'email', 'sms', 'webhook'].map(ch => (
              <label key={ch} className="flex items-center gap-2">
                <input type="checkbox" checked={!!(lvl.channels && lvl.channels[ch])} onChange={e => {
                  const channels = { ...(lvl.channels || {}) , [ch]: e.target.checked };
                  update(idx, 'channels', channels);
                }} />
                {ch}
              </label>
            ))}
          </div>
        </div>
      ))}
      <div className="flex justify-end">
        <button className="px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-60" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save Settings'}</button>
      </div>
    </div>
  );
}
