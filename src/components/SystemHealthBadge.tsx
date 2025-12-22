import { useEffect, useMemo, useState } from 'react';
import { apiUrl } from '@/lib/apiBase';

type HealthStatus = 'healthy' | 'warning' | 'critical' | 'unknown';

type HealthPayload = {
  success?: boolean;
  proxied?: boolean;
  status?: number;
  latencyMs?: number;
  backend?: any;
  target?: string;
  lastError?: string;
};

const statusStyle: Record<HealthStatus, { bg: string; text: string; dot: string; label: string }> = {
  healthy: {
    bg: 'bg-green-50 dark:bg-green-900/15 border-green-200 dark:border-green-700',
    text: 'text-green-800 dark:text-green-300',
    dot: 'bg-green-500',
    label: 'Healthy',
  },
  warning: {
    bg: 'bg-yellow-50 dark:bg-yellow-900/15 border-yellow-200 dark:border-yellow-700',
    text: 'text-yellow-800 dark:text-yellow-300',
    dot: 'bg-yellow-500',
    label: 'Warning',
  },
  critical: {
    bg: 'bg-red-50 dark:bg-red-900/15 border-red-200 dark:border-red-700',
    text: 'text-red-800 dark:text-red-300',
    dot: 'bg-red-500',
    label: 'Critical',
  },
  unknown: {
    bg: 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
    text: 'text-slate-700 dark:text-slate-300',
    dot: 'bg-slate-400',
    label: 'Unknown',
  },
};

function deriveStatus(data: HealthPayload): HealthStatus {
  try {
    if (!data) return 'unknown';
    const backend = (data as any).backend;
    if (backend && typeof backend === 'object') {
      const s = (backend.status || backend.health || '').toString().toLowerCase();
      if (s === 'healthy') return 'healthy';
      if (s === 'warning' || s === 'degraded' || s === 'degrade') return 'warning';
      if (s === 'critical' || s === 'down' || s === 'error') return 'critical';
      const cpu = Number(backend.cpu ?? backend.cpuUsage ?? NaN);
      const mem = Number(backend.memory ?? backend.memoryUsage ?? NaN);
      if (!Number.isNaN(cpu) || !Number.isNaN(mem)) {
        if (cpu > 80 || mem > 85) return 'critical';
        if (cpu > 60 || mem > 75) return 'warning';
        return 'healthy';
      }
    }
    // Fallbacks on HTTP-ish status
    if (typeof data.status === 'number') {
      if (data.status >= 500) return 'critical';
      if (data.status >= 400) return 'warning';
      if (data.status >= 200 && data.status < 300) return 'healthy';
    }
    return data.success ? 'healthy' : 'unknown';
  } catch {
    return 'unknown';
  }
}

export default function SystemHealthBadge(): JSX.Element {
  const [info, setInfo] = useState<HealthPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const status: HealthStatus = useMemo(() => deriveStatus(info || {} as any), [info]);
  const styles = statusStyle[status];
  const latency = typeof info?.latencyMs === 'number' ? `${Math.round(info!.latencyMs!)}ms` : '—';

  useEffect(() => {
    let isMounted = true;

    const pull = async () => {
      try {
        const url = apiUrl('/system/health');
        const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        const r = await fetch(url, { credentials: 'include' });
        const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        const ct = r.headers.get('content-type') || '';
        const latencyMs = Math.max(0, Math.round(t1 - t0));

        if (!/application\/json/i.test(ct)) {
          const text = await r.text().catch(() => '');
          if (!isMounted) return;
          setInfo({ success: false, status: r.status, latencyMs, backend: { nonJson: true, text } });
          return;
        }

        const json = (await r.json().catch(() => ({}))) as HealthPayload;
        if (!isMounted) return;
        setInfo({ ...json, status: json.status ?? r.status, latencyMs: json.latencyMs ?? latencyMs, success: json.success ?? (r.ok ? true : false) });
        setError(null);
      } catch (e: any) {
        if (!isMounted) return;
        // Reduce console noise: rely on UI message instead of logging
        setError(e?.response?.data?.message || 'Failed to fetch');
        setInfo({ success: false });
      }
    };

    // initial call
    pull();
    const id = window.setInterval(pull, 60_000);
    return () => {
      isMounted = false;
      window.clearInterval(id);
    };
  }, [refreshTick]);

  const waking = useMemo(() => {
    const d = info || {} as HealthPayload;
    // Heuristic: proxied call failed without HTTP status/latency yet → likely backend waking/cold start
    return d?.proxied && d?.success === false && typeof d?.status !== 'number' && typeof d?.latencyMs !== 'number';
  }, [info]);

  // When we detect waking, try a direct no-cors warm-up to the backend origin from the browser.
  useEffect(() => {
    if (!waking) return;
    // Local dev uses the Vite proxy; the Vercel-only '/api/system/backend-origin' helper is not available.
    if (import.meta.env.DEV) return;
    let cancelled = false;
    (async () => {
      try {
        const meta = await fetch('/api/system/backend-origin', { credentials: 'include' }).then(r => r.json()).catch(() => null as any);
        const origin: string | null = meta?.origin || null;
        if (!origin) return;
        // Fire-and-forget warm-up; no-cors avoids CORS failure, we don't need the body.
        if (!cancelled) {
          const base = /\/api$/i.test(origin) ? origin : `${origin}/api`;
          fetch(origin, { mode: 'no-cors' }).catch(() => {});
          fetch(`${origin}/api/health`, { mode: 'no-cors' }).catch(() => {});
          fetch(`${base}/system/health`, { mode: 'no-cors' }).catch(() => {});
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [waking]);

  return (
    <div className={`inline-flex items-center gap-3 px-3 py-2 rounded-lg border ${styles.bg} ${styles.text}`} title={info?.target ? `Health target: ${info.target}` : undefined}>
      <span className={`inline-block w-2.5 h-2.5 rounded-full ${styles.dot}`}></span>
      <span className="text-sm font-medium">System Health: {styles.label}</span>
      <span className="text-xs opacity-70">•</span>
      <span className="text-xs">Latency: {latency}</span>
      {waking && (
        <>
          <span className="text-xs opacity-70">• Backend waking…</span>
          <button className="text-xs underline opacity-80" onClick={() => setRefreshTick((t) => t + 1)}>Retry</button>
        </>
      )}
      {error && <span className="text-xs opacity-70">• {error}</span>}
    </div>
  );
}
