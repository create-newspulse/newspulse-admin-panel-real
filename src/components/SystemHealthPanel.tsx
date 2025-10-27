import { useEffect, useMemo, useState } from 'react';

type HealthStatus = 'healthy' | 'warning' | 'critical' | 'unknown';

type HealthEnvelope = {
  success?: boolean;
  proxied?: boolean;
  target?: string;
  status?: number;
  contentType?: string;
  latencyMs?: number;
  backend?: any;
  ts?: string;
};

const statusChip: Record<HealthStatus, string> = {
  healthy: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300',
  warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300',
  critical: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300',
  unknown: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
};

function deriveStatus(data: HealthEnvelope): HealthStatus {
  try {
    if (!data) return 'unknown';
    const b = data.backend;
    if (b && typeof b === 'object') {
      const s = (b.status || b.health || '').toString().toLowerCase();
      if (s === 'healthy') return 'healthy';
      if (s === 'warning' || s === 'degraded' || s === 'degrade') return 'warning';
      if (s === 'critical' || s === 'down' || s === 'error') return 'critical';
      const cpu = Number(b.cpu ?? b.cpuUsage ?? NaN);
      const mem = Number(b.memory ?? b.memoryUsage ?? NaN);
      if (!Number.isNaN(cpu) || !Number.isNaN(mem)) {
        if (cpu > 80 || mem > 85) return 'critical';
        if (cpu > 60 || mem > 75) return 'warning';
        return 'healthy';
      }
    }
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

export default function SystemHealthPanel(): JSX.Element {
  const [env, setEnv] = useState<HealthEnvelope | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<boolean>(false);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  const status: HealthStatus = useMemo(() => deriveStatus(env || {} as any), [env]);
  const latency = typeof env?.latencyMs === 'number' ? `${Math.round(env!.latencyMs!)}ms` : '—';

  useEffect(() => {
    let mounted = true;
    let timer: any;

    const pull = async () => {
      try {
        const r = await fetch('/api/system/health', { credentials: 'include' });
        const ct = r.headers.get('content-type') || '';
        if (!/application\/json/i.test(ct)) {
          const txt = await r.text().catch(() => '');
          if (mounted) setEnv({ success: false, status: r.status, contentType: ct, backend: { nonJson: true, text: txt } });
          return;
        }
        const json = (await r.json()) as HealthEnvelope;
        if (mounted) {
          setEnv(json);
          setError(null);
        }
      } catch (e: any) {
        if (mounted) {
          setError(e?.message || 'Failed to load system health');
          setEnv({ success: false });
        }
      } finally {
        if (autoRefresh) timer = setTimeout(pull, 10_000);
      }
    };

    pull();
    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [autoRefresh]);

  const b = env?.backend || {};
  const num = (v: any): number | null => (typeof v === 'number' && !Number.isNaN(v) ? v : null);
  const cpu = num(b.cpu ?? b.cpuUsage);
  const mem = num(b.memory ?? b.memoryUsage);
  const storage = num(b.storage ?? b.disk ?? b.diskUsage);
  const activeUsers = num(b.activeUsers);
  const rpm = num(b.requestsPerMinute ?? b.rpm);
  const uptime = (b.uptime || b.uptimeMs || b.uptimeSeconds || '') as string | number;

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xl font-semibold">🩺 System Health</h3>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 text-xs rounded ${statusChip[status]}`}>{status.toUpperCase()}</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">Latency: {latency}</span>
          <button
            className="text-xs px-2 py-1 rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={() => setAutoRefresh((v) => !v)}
            aria-pressed={autoRefresh}
          >{autoRefresh ? 'Pause' : 'Resume'}</button>
          <button
            className="text-xs px-2 py-1 rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >{expanded ? 'Hide Raw' : 'Show Raw'}</button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 dark:text-red-400 mb-3">❌ {error}</div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
          <div className="text-xs text-slate-500 mb-1">CPU</div>
          <div className="text-2xl font-bold">{cpu !== null ? `${cpu.toFixed(1)}%` : '—'}</div>
          <div className="mt-2 h-2 rounded bg-slate-200 dark:bg-slate-700">
            <div className={`h-2 rounded ${cpu !== null ? (cpu > 80 ? 'bg-red-500' : cpu > 60 ? 'bg-yellow-500' : 'bg-green-500') : 'bg-slate-400'}`} style={{ width: `${Math.max(0, Math.min(100, cpu ?? 0))}%` }} />
          </div>
        </div>

        <div className="p-4 rounded-lg border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
          <div className="text-xs text-slate-500 mb-1">Memory</div>
          <div className="text-2xl font-bold">{mem !== null ? `${mem.toFixed(1)}%` : '—'}</div>
          <div className="mt-2 h-2 rounded bg-slate-200 dark:bg-slate-700">
            <div className={`h-2 rounded ${mem !== null ? (mem > 85 ? 'bg-red-500' : mem > 75 ? 'bg-yellow-500' : 'bg-green-500') : 'bg-slate-400'}`} style={{ width: `${Math.max(0, Math.min(100, mem ?? 0))}%` }} />
          </div>
        </div>

        <div className="p-4 rounded-lg border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
          <div className="text-xs text-slate-500 mb-1">Storage</div>
          <div className="text-2xl font-bold">{storage !== null ? `${storage.toFixed(1)}%` : '—'}</div>
          <div className="mt-2 h-2 rounded bg-slate-2 00 dark:bg-slate-700">
            <div className={`h-2 rounded ${storage !== null ? (storage > 90 ? 'bg-red-500' : storage > 75 ? 'bg-yellow-500' : 'bg-green-500') : 'bg-slate-400'}`} style={{ width: `${Math.max(0, Math.min(100, storage ?? 0))}%` }} />
          </div>
        </div>

        <div className="p-4 rounded-lg border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
          <div className="text-xs text-slate-500 mb-1">Uptime</div>
          <div className="text-xl font-semibold">{uptime || '—'}</div>
          <div className="text-xs text-slate-500 mt-1">Target: {env?.target || '—'}</div>
        </div>

        <div className="p-4 rounded-lg border bg-white dark:bg-slate-8 00 border-slate-200 dark:border-slate-700">
          <div className="text-xs text-slate-500 mb-1">Active Users</div>
          <div className="text-2xl font-bold">{activeUsers !== null ? activeUsers : '—'}</div>
        </div>

        <div className="p-4 rounded-lg border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
          <div className="text-xs text-slate-500 mb-1">Requests / min</div>
          <div className="text-2xl font-bold">{rpm !== null ? rpm : '—'}</div>
        </div>
      </div>

      {expanded && (
        <div className="mt-4">
          <div className="text-xs text-slate-500 mb-1">Raw payload</div>
          <pre className="ai-debug-box text-xs">
            {JSON.stringify(env, null, 2)}
          </pre>
        </div>
      )}
    </section>
  );
}
