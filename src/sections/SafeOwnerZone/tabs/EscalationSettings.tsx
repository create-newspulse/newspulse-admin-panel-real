import { useEffect, useState } from 'react';
import { useFounderActions } from '../hooks/useFounderActions';
import { useNotify } from '@/components/ui/toast-bridge';

export default function EscalationSettings() {
  const { getEscalation, saveEscalation } = useFounderActions();
  const notify = useNotify();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await getEscalation();
        const payload = r?.data ?? (r?.levels ? r : null);
        if (!payload) throw new Error('Invalid response');
        if (!cancelled) setData(payload);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load escalation');
      }
    })();
    return () => { cancelled = true; };
  }, []);
  if (error) return <div className="text-red-600">Failed to load: {error}</div>;
  if (!data) return <div>Loading…</div>;

  function update(level: number, field: string, value: any) {
    const copy = JSON.parse(JSON.stringify(data));
    copy.levels[level][field] = value;
    setData(copy);
  }

  async function save() {
    const prev = data;
    // optimistic timestamp
    const optimistic = { ...data, updatedAt: new Date().toISOString() };
    setData(optimistic);
    const r = await saveEscalation(data);
    const ok = r?.ok ?? !!r?.levels;
    const payload = r?.data ?? (ok ? r : null);
    if (ok && payload) {
      setData(payload);
      notify.ok('Escalation saved', new Date(r.data.updatedAt).toLocaleString());
    } else {
      setData(prev);
      notify.err('Save failed', r.error ?? 'Try again');
    }
  }

  return (
    <div className="space-y-6">
      {data.levels.map((lvl: any, idx: number) => (
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
          <input className="border rounded w-full px-2 py-1 mb-2" value={lvl.triggers.join(',')} onChange={e => update(idx, 'triggers', e.target.value.split(',').map((s) => s.trim()))} />
          <div className="grid grid-cols-4 gap-3">
            {['dashboard', 'email', 'sms', 'webhook'].map(ch => (
              <label key={ch} className="flex items-center gap-2">
                <input type="checkbox" checked={lvl.channels[ch]} onChange={e => {
                  const copy = JSON.parse(JSON.stringify(data));
                  copy.levels[idx].channels[ch] = e.target.checked;
                  setData(copy);
                }} />
                {ch}
              </label>
            ))}
          </div>
        </div>
      ))}
      <div className="flex justify-end">
        <button className="px-3 py-1 rounded bg-blue-600 text-white" onClick={save}>Save Settings</button>
      </div>
    </div>
  );
}
