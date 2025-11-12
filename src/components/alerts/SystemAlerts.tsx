import { useEffect, useRef, useState } from 'react';
import { getSystemAlerts } from '@/lib/adminUiApi';
import { toast } from 'sonner';

type AlertEntry = { id: string; level: 'info'|'warn'|'error'; title: string; message: string; ts: string };

export default function SystemAlerts() {
  const [alerts, setAlerts] = useState<AlertEntry[]>([]);
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      try {
        const data = await getSystemAlerts();
        const list: AlertEntry[] = data.alerts || [];
        if (!stopped) setAlerts(list.slice(0, 10));
        for (const a of list) {
          if (!seenRef.current.has(a.id)) {
            seenRef.current.add(a.id);
            if (a.level === 'error') toast.error(`${a.title}: ${a.message}`);
            else if (a.level === 'warn') toast.warning(`${a.title}: ${a.message}`);
            else toast(`${a.title}: ${a.message}`);
          }
        }
      } catch {}
      if (!stopped) setTimeout(tick, 30_000);
    };
    tick();
    return () => { stopped = true; };
  }, []);

  return (
    <div className="rounded-lg border dark:border-slate-800 bg-white dark:bg-slate-900">
      <div className="px-4 py-2 text-sm font-semibold border-b dark:border-slate-800">System Alerts</div>
      <ul className="divide-y dark:divide-slate-800">
        {alerts.map(a => (
          <li key={a.id} className="px-4 py-2 text-sm flex items-start gap-2">
            <span className={{ info: 'text-blue-600', warn: 'text-amber-600', error: 'text-red-600' }[a.level] || 'text-slate-500'}>●</span>
            <div>
              <div className="font-medium">{a.title}</div>
              <div className="opacity-80">{a.message}</div>
            </div>
          </li>
        ))}
        {alerts.length === 0 && (
          <li className="px-4 py-3 text-sm opacity-70">No recent alerts</li>
        )}
      </ul>
    </div>
  );
}
