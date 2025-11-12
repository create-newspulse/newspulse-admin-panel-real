import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { getSystemAlerts } from '@/lib/adminUiApi';

type Alert = { id: string; level: 'info'|'warn'|'error'; title: string; message: string; ts: string };

export default function SystemAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const latestId = useRef<string | null>(null);

  useEffect(() => {
    let stop = false;
    const run = async () => {
      try {
        const r = await getSystemAlerts();
        const list: Alert[] = r.alerts?.slice?.(0, 10) || [];
        setAlerts(list);
        if (list[0]?.id && list[0].id !== latestId.current) {
          latestId.current = list[0].id;
          // Notify on new item
          const a = list[0];
          toast(`${a.title}: ${a.message}`, { description: new Date(a.ts).toLocaleString() });
        }
      } catch {}
      if (!stop) setTimeout(run, 30_000);
    };
    run();
    return () => { stop = true; };
  }, []);

  return (
    <div className="rounded-lg border dark:border-slate-800 bg-white dark:bg-slate-900">
      <div className="px-4 py-2 border-b dark:border-slate-800 text-sm font-medium">System Alerts</div>
      <ul className="divide-y dark:divide-slate-800 text-sm">
        {alerts.length === 0 && (
          <li className="px-4 py-3 opacity-70">No alerts</li>
        )}
        {alerts.map(a => (
          <li key={a.id} className="px-4 py-3 flex items-start gap-2">
            <span className="mt-1.5 inline-block w-2 h-2 rounded-full bg-amber-500" />
            <div>
              <div className="font-medium">{a.title}</div>
              <div className="opacity-80">{a.message}</div>
              <div className="text-xs opacity-60">{new Date(a.ts).toLocaleString()}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
