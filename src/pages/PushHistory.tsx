import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import { safeSettingsLoad } from '../lib/api';
import { useLockdownCheck } from '@hooks/useLockdownCheck';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { useAuth } from '@/context/AuthContext';
import { deleteAllPushHistory, listPushHistory, type PushEvent } from '@/lib/api/workflow';

function roleCaps(roleRaw: any) {
  const role = String(roleRaw || '').toLowerCase();
  const isFounder = role === 'founder';
  const isEditor = isFounder || role === 'admin' || role === 'editor';
  const isStaff = !isEditor;
  return { role, isFounder, isEditor, isStaff };
}

function toCsvRow(fields: Array<string | number | null | undefined>): string {
  return fields
    .map((v) => {
      const s = v == null ? '' : String(v);
      const needsQuote = /[",\n]/.test(s);
      const escaped = s.replaceAll('"', '""');
      return needsQuote ? `"${escaped}"` : escaped;
    })
    .join(',');
}

export default function PushHistory() {
  const { user } = useAuth();
  const caps = roleCaps(user?.role);

  const [entries, setEntries] = useState<PushEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({ lockdown: false });

  const [q, setQ] = useState('');
  const [channel, setChannel] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const limit = 50;

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busyDeleteAll, setBusyDeleteAll] = useState(false);
  const [endpointMissing, setEndpointMissing] = useState(false);

  useEffect(() => {
    safeSettingsLoad({ skipProbe: true })
      .then((raw: any) => {
        setSettings({ lockdown: !!raw.lockdown });
        if (raw?._stub) console.warn('[PushHistory] settings stub active');
      })
      .catch(() => setSettings({ lockdown: false }));
  }, []);

  useLockdownCheck(settings);

  const query = useMemo(() => ({ q: q.trim() || undefined, channel: channel || undefined, status: status || undefined, page, limit }), [q, channel, status, page]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await listPushHistory(query);
      setEntries(res.rows);
      setTotal(res.total);
      setEndpointMissing(Boolean((res as any)?._missing));
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Failed to fetch push history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.q, query.channel, query.status, query.page, query.limit]);

  const canDeleteAll = caps.isFounder && !settings.lockdown;

  const deleteAll = async () => {
    if (!canDeleteAll) {
      toast.error('Founder permission required');
      return;
    }
    setBusyDeleteAll(true);
    try {
      await deleteAllPushHistory();
      toast.success('Push history deleted');
      setConfirmOpen(false);
      setPage(1);
      await fetchHistory();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Delete failed');
    } finally {
      setBusyDeleteAll(false);
    }
  };

  const exportCsv = async () => {
    try {
      const res = await listPushHistory({ ...query, page: 1, limit: 500 });
      const header = toCsvRow(['at', 'articleId', 'title', 'channel', 'status', 'actorEmail']);
      const lines = res.rows.map((e) =>
        toCsvRow([
          new Date(e.at).toISOString(),
          e.articleId,
          e.title,
          e.channel,
          e.status,
          e.actor?.email || '',
        ])
      );
      const csv = [header, ...lines].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `push-history-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Export failed');
    }
  };

  if (settings.lockdown) {
    return (
      <div className="p-4 text-center text-red-700 dark:text-red-300">
        Push history access is disabled in lockdown mode.
      </div>
    );
  }

  return (
    <div className="p-3">
      <ConfirmModal
        open={confirmOpen}
        title="Delete all push history?"
        description="This action cannot be undone. Founder permission is required."
        confirmLabel={busyDeleteAll ? 'Deleting…' : 'Delete All'}
        cancelLabel="Cancel"
        onConfirm={deleteAll}
        onCancel={() => setConfirmOpen(false)}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-slate-900 dark:text-white">Push History</div>
          <div className="text-sm text-slate-600 dark:text-slate-300">Audit log of publish/push events.</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportCsv}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            Export CSV
          </button>
          <button
            type="button"
            disabled={!canDeleteAll}
            onClick={() => setConfirmOpen(true)}
            className={
              'rounded-md border px-3 py-2 text-sm font-semibold ' +
              (!canDeleteAll
                ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-600'
                : 'border-red-600 bg-red-600 text-white hover:bg-red-500')
            }
          >
            Delete All
          </button>
        </div>
      </div>

      {endpointMissing ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
          Backend endpoint not ready — push history is unavailable right now.
        </div>
      ) : null}

      <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
        <input
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
          placeholder="Search title or articleId…"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
        <select
          value={channel}
          onChange={(e) => {
            setPage(1);
            setChannel(e.target.value);
          }}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        >
          <option value="">All channels</option>
          <option value="web">web</option>
          <option value="app">app</option>
          <option value="push">push</option>
        </select>
        <select
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        >
          <option value="">All statuses</option>
          <option value="success">success</option>
          <option value="failed">failed</option>
        </select>
      </div>

      {loading ? (
        <div className="mt-4 text-sm text-slate-600 dark:text-slate-300">Loading…</div>
      ) : entries.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
          {endpointMissing ? 'Backend endpoint not ready.' : 'No push history found.'}
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <table className="min-w-full text-sm text-slate-700 dark:text-slate-200">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-xs uppercase text-slate-500 dark:text-slate-400">
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Article</th>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Channel</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actor</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-t border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                >
                  <td className="px-3 py-2 whitespace-nowrap">{new Date(entry.at).toLocaleString()}</td>
                  <td className="px-3 py-2 font-mono text-xs">{entry.articleId.slice(-8)}</td>
                  <td className="px-3 py-2 max-w-[520px] truncate">{entry.title}</td>
                  <td className="px-3 py-2">{entry.channel}</td>
                  <td className="px-3 py-2">{entry.status}</td>
                  <td className="px-3 py-2">{entry.actor?.email || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
        <div>
          {total > 0 ? (
            <span>
              Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
            </span>
          ) : (
            <span />
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            Prev
          </button>
          <button
            type="button"
            disabled={page * limit >= total}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
