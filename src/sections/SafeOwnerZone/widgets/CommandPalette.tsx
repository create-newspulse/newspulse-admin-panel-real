import { useEffect, useMemo, useState } from 'react';
import { useFounderActions } from '../hooks/useFounderActions';
import { useNotify } from '@/components/ui/toast-bridge';
import { useNavigate } from 'react-router-dom';

type Item = { id: string; title: string; hint?: string; run: () => Promise<void> | void };

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [pin, setPin] = useState('');
  const navigate = useNavigate();
  const { lockdown, snapshot, listSnapshots, rollback } = useFounderActions();
  const notify = useNotify();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(v => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const items: Item[] = useMemo(() => [
    { id: 'nav:security', title: 'Open → Security & Lockdown', run: () => navigate('/safeownerzone/security') },
    { id: 'nav:compliance', title: 'Open → Compliance & Policy', run: () => navigate('/safeownerzone/compliance') },
    { id: 'nav:ai', title: 'Open → AI Control', run: () => navigate('/safeownerzone/ai') },
    {
      id: 'action:lockdown',
      title: 'Trigger Lockdown (requires PIN)',
      run: async () => {
        if (!pin) { notify.err('PIN required'); return; }
        const r = await lockdown({ reason: 'Palette action', scope: 'site', pin });
        (window as any).__LOCK_STATE__ = r.ok ? 'LOCKED' : (window as any).__LOCK_STATE__ || 'UNLOCKED';
        if (r.ok) notify.ok('Lockdown ON'); else notify.err('Lockdown failed', r.error);
      }
    },
    {
      id: 'action:snapshot',
      title: 'Create Snapshot',
      run: async () => {
        const r = await snapshot('Palette snapshot');
        if (r.ok && r.id) (window as any).__LAST_SNAPSHOT_ID__ = r.id;
        if (r.ok) notify.ok('Snapshot created', r.id); else notify.err('Snapshot failed', r.error);
      }
    },
    {
      id: 'action:rollback',
      title: 'Rollback (select snapshot)…',
      run: async () => {
        const l = await listSnapshots();
        const id = prompt('Enter snapshotId to dry-run:\n' + (l.items || []).map((s: any) => `${s.id}  — ${s.note}`).join('\n'));
        if (!id) return;
        const res = await rollback(id, true);
        if (res.ok) notify.ok('Rollback dry-run OK', id); else notify.err('Rollback dry-run failed', res.error);
      }
    },
  ], [pin, navigate, lockdown, snapshot, listSnapshots, rollback]);

  const filtered = items.filter(i => i.title.toLowerCase().includes(q.toLowerCase()));

  if (!open) return (
    <button className="rounded px-3 py-1 text-sm border" onClick={() => setOpen(true)} title="Command Palette (⌘K)">⌘K</button>
  );

  return (
    <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setOpen(false)}>
      <div className="mx-auto mt-24 w-full max-w-xl rounded-lg bg-white p-4 shadow" onClick={e => e.stopPropagation()}>
        <div className="flex gap-2 mb-2">
          <input className="flex-1 border rounded px-3 py-2" autoFocus placeholder="Type a command…" value={q} onChange={e => setQ(e.target.value)} />
          <input className="w-40 border rounded px-2" placeholder="Founder PIN" value={pin} onChange={e => setPin(e.target.value)} />
        </div>
        <ul className="max-h-64 overflow-auto">
          {filtered.map(i => (
            <li key={i.id} className="px-3 py-2 hover:bg-gray-100 cursor-pointer rounded" onClick={async () => { await i.run(); setOpen(false); }}>
              {i.title} {i.hint && <span className="text-xs text-gray-500">— {i.hint}</span>}
            </li>
          ))}
          {filtered.length === 0 && <li className="px-3 py-6 text-sm text-gray-500">No matches…</li>}
        </ul>
      </div>
    </div>
  );
}
