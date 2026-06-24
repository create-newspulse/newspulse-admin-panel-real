import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@context/AuthContext';
import { toast } from 'react-hot-toast';
import { getAuditLogs, toFriendlyErrorMessage, type AuditLogRow } from '@/api/adminPanelSettingsApi';

type AuditFilters = {
  date: string;
  staff: string;
  module: string;
  action: string;
  result: string;
  severity: string;
  search: string;
};

const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100';
const secretKeyPattern = /(password|token|secret|otp|2fa|authorization|cookie|jwt|key|passphrase)/i;

function readValue(row: any, keys: string[], fallback = '-'): string {
  for (const key of keys) {
    const value = key.split('.').reduce((current, part) => current?.[part], row);
    if (value !== undefined && value !== null && String(value).trim()) return String(value);
  }
  return fallback;
}

function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (!value || typeof value !== 'object') return value;
  return Object.entries(value as Record<string, unknown>).reduce((acc, [key, entry]) => {
    acc[key] = secretKeyPattern.test(key) ? '[redacted]' : redactSecrets(entry);
    return acc;
  }, {} as Record<string, unknown>);
}

function formatWhen(value: string): string {
  if (!value || value === '-') return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function AuditLogsView() {
  const { user } = useAuth();
  const role = String(user?.role || '').toLowerCase();
  const isFounder = role === 'founder';

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [filters, setFilters] = useState<AuditFilters>({ date: '', staff: '', module: '', action: '', result: '', severity: '', search: '' });

  useEffect(() => {
    if (!isFounder) {
      setLoading(false);
      setRows([]);
      setErr('Founder permission required.');
      return;
    }
    let mounted = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const items = await getAuditLogs(200);
        if (!mounted) return;
        setRows(Array.isArray(items) ? items : []);
      } catch (e: any) {
        if (!mounted) return;
        const msg = toFriendlyErrorMessage(e, 'Audit log unavailable');
        setErr(msg);
        toast.error(msg);
        setRows([]);
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [isFounder]);

  const formatted = useMemo(() => rows.map((row) => {
    const raw: any = row;
    const time = readValue(raw, ['time', 'ts', 'timestamp', 'createdAt', 'created_at']);
    const actor = readValue(raw, ['actorEmail', 'actor.email', 'actorName', 'actor.name', 'actorId', 'userEmail', 'user.email'], 'system');
    const action = readValue(raw, ['action', 'type', 'event', 'operation']);
    const target = readValue(raw, ['target', 'targetEmail', 'target.email', 'targetId', 'staffEmail', 'staffId']);
    const moduleName = readValue(raw, ['module', 'moduleName', 'area', 'resource', 'scope']);
    const result = readValue(raw, ['result', 'status', 'outcome'], 'success');
    const severity = readValue(raw, ['severity', 'level'], 'info');
    const reason = readValue(raw, ['reason', 'meta.reason', 'payload.reason', 'details.reason']);
    const ip = readValue(raw, ['ip', 'ipAddress', 'request.ip', 'meta.ip', 'device.ip']);
    const device = readValue(raw, ['device', 'userAgent', 'request.userAgent', 'meta.device', 'meta.userAgent']);
    const meta = redactSecrets(raw.meta ?? raw.payload ?? raw.details ?? {});
    return { raw, time, when: formatWhen(time), actor, action, target, moduleName, result, severity, reason, ip, device, meta };
  }), [rows]);

  const filtered = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    return formatted.filter((row) => {
      if (filters.date && !String(row.time).startsWith(filters.date)) return false;
      if (filters.staff && !row.actor.toLowerCase().includes(filters.staff.toLowerCase()) && !row.target.toLowerCase().includes(filters.staff.toLowerCase())) return false;
      if (filters.module && row.moduleName !== filters.module) return false;
      if (filters.action && row.action !== filters.action) return false;
      if (filters.result && row.result !== filters.result) return false;
      if (filters.severity && row.severity !== filters.severity) return false;
      if (query) {
        const haystack = [row.when, row.actor, row.action, row.target, row.moduleName, row.result, row.severity, row.reason, row.ip, row.device].join(' ').toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [filters, formatted]);

  const optionsFor = (key: 'moduleName' | 'action' | 'result' | 'severity') => Array.from(new Set(formatted.map((row) => row[key]).filter((value) => value && value !== '-'))).sort();

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-lg font-semibold text-slate-950">Audit Logs</div>
        <div className="mt-1 text-sm text-slate-600">Read-only audit events for admin actions. Secrets, passwords, tokens, and auth data are redacted.</div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-7">
          <label className="text-sm font-semibold text-slate-800">Date<input type="date" value={filters.date} onChange={(event) => setFilters((state) => ({ ...state, date: event.target.value }))} className={inputClass} /></label>
          <label className="text-sm font-semibold text-slate-800">Staff<input value={filters.staff} onChange={(event) => setFilters((state) => ({ ...state, staff: event.target.value }))} className={inputClass} placeholder="Actor or target" /></label>
          <label className="text-sm font-semibold text-slate-800">Module<select value={filters.module} onChange={(event) => setFilters((state) => ({ ...state, module: event.target.value }))} className={inputClass}><option value="">All</option>{optionsFor('moduleName').map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label className="text-sm font-semibold text-slate-800">Action<select value={filters.action} onChange={(event) => setFilters((state) => ({ ...state, action: event.target.value }))} className={inputClass}><option value="">All</option>{optionsFor('action').map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label className="text-sm font-semibold text-slate-800">Result<select value={filters.result} onChange={(event) => setFilters((state) => ({ ...state, result: event.target.value }))} className={inputClass}><option value="">All</option>{optionsFor('result').map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label className="text-sm font-semibold text-slate-800">Severity<select value={filters.severity} onChange={(event) => setFilters((state) => ({ ...state, severity: event.target.value }))} className={inputClass}><option value="">All</option>{optionsFor('severity').map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label className="text-sm font-semibold text-slate-800">Search<input value={filters.search} onChange={(event) => setFilters((state) => ({ ...state, search: event.target.value }))} className={inputClass} placeholder="Search" /></label>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {loading ? <div className="text-slate-600">Loading...</div> : err ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">{err}</div> : filtered.length === 0 ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">No audit events match the current filters.</div> : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead><tr className="text-left text-slate-600"><th className="py-2 pr-3">Time</th><th className="py-2 pr-3">Actor</th><th className="py-2 pr-3">Action</th><th className="py-2 pr-3">Target</th><th className="py-2 pr-3">Module</th><th className="py-2 pr-3">Result</th><th className="py-2 pr-3">Severity</th><th className="py-2 pr-3">Reason</th><th className="py-2 pr-3">IP / Device</th><th className="py-2 pr-3">Details</th></tr></thead>
              <tbody>{filtered.map((row, index) => <tr key={`${row.time}-${row.action}-${index}`} className="border-t border-slate-200 align-top"><td className="py-3 pr-3 text-slate-700">{row.when}</td><td className="py-3 pr-3 font-semibold text-slate-900">{row.actor}</td><td className="py-3 pr-3 text-slate-700">{row.action}</td><td className="py-3 pr-3 text-slate-700">{row.target}</td><td className="py-3 pr-3 text-slate-700">{row.moduleName}</td><td className="py-3 pr-3"><span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">{row.result}</span></td><td className="py-3 pr-3"><span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">{row.severity}</span></td><td className="py-3 pr-3 text-slate-700">{row.reason}</td><td className="py-3 pr-3 text-slate-700">{row.ip}<br /><span className="text-xs text-slate-500">{row.device}</span></td><td className="py-3 pr-3">{Object.keys(row.meta as Record<string, unknown>).length ? <details className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><summary className="cursor-pointer text-xs font-semibold text-slate-700">View redacted JSON</summary><pre className="mt-2 max-h-64 overflow-auto text-xs text-slate-800">{JSON.stringify(row.meta, null, 2)}</pre></details> : '-'}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
