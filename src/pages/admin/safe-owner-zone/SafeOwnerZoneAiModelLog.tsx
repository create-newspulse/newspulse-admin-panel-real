import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api, getOwnerUnlockToken } from '@/lib/http';
import { useNotify } from '@/components/ui/toast-bridge';
import type { OwnerZoneShellContext } from './SafeOwnerZoneShell';
import { useAuth } from '@context/AuthContext';

type ProviderKey = 'openai' | 'gemini';

type AiModelLogRow = {
  at?: string;
  reason?: string;
  modeBefore?: string;
  modeAfter?: string;
  modelBefore?: string;
  modelAfter?: string;
  changedBy?: string;
  ip?: string;
  raw?: any;
};

function formatDateTime(ts?: string): string {
  if (!ts) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString();
}

function toStr(v: any): string {
  if (typeof v === 'string') return v;
  if (v == null) return '';
  return String(v);
}

function normalizeLogRow(raw: any): AiModelLogRow {
  const before = raw?.before ?? raw?.prev ?? raw?.from ?? {};
  const after = raw?.after ?? raw?.next ?? raw?.to ?? {};

  const at =
    raw?.ts ??
    raw?.time ??
    raw?.timestamp ??
    raw?.createdAt ??
    raw?.created_at ??
    raw?.at ??
    raw?.date ??
    null;

  const changedBy =
    raw?.changedBy ??
    raw?.actor ??
    raw?.actorId ??
    raw?.user ??
    raw?.email ??
    raw?.by ??
    null;

  const modeBefore = raw?.modeBefore ?? before?.mode ?? before?.modelMode ?? before?.modeType ?? null;
  const modeAfter = raw?.modeAfter ?? after?.mode ?? after?.modelMode ?? after?.modeType ?? null;

  const modelBefore = raw?.modelBefore ?? before?.model ?? before?.pinnedModel ?? before?.resolvedModel ?? null;
  const modelAfter = raw?.modelAfter ?? after?.model ?? after?.pinnedModel ?? after?.resolvedModel ?? null;

  const reason = raw?.reason ?? raw?.message ?? raw?.note ?? raw?.details ?? null;
  const ip = raw?.ip ?? raw?.ipAddress ?? raw?.remoteIp ?? raw?.remoteAddress ?? null;

  return {
    at: typeof at === 'string' ? at : at ? String(at) : undefined,
    reason: toStr(reason) || undefined,
    modeBefore: toStr(modeBefore) || undefined,
    modeAfter: toStr(modeAfter) || undefined,
    modelBefore: toStr(modelBefore) || undefined,
    modelAfter: toStr(modelAfter) || undefined,
    changedBy: toStr(changedBy) || undefined,
    ip: toStr(ip) || undefined,
    raw,
  };
}

function pickResolvedModel(status: any, provider: ProviderKey): string {
  try {
    const root = status || {};
    const byProvider = root?.[provider] || root?.providers?.[provider] || root?.status?.[provider] || null;
    const resolved =
      byProvider?.resolvedModel ??
      byProvider?.resolved ??
      byProvider?.model ??
      byProvider?.selectedModel ??
      root?.resolved?.[provider] ??
      root?.models?.resolved?.[provider] ??
      '';
    return typeof resolved === 'string' ? resolved : resolved ? String(resolved) : '';
  } catch {
    return '';
  }
}

export default function SafeOwnerZoneAiModelLog(): JSX.Element {
  const notify = useNotify();
  const { user } = useAuth();

  const {
    canUseDangerActions,
    busy,
  } = useOutletContext<OwnerZoneShellContext>();

  const isFounder = useMemo(() => String((user as any)?.role || '').toLowerCase() === 'founder', [user]);

  const [provider, setProvider] = useState<ProviderKey>('openai');
  const [limit] = useState(50);

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<AiModelLogRow[]>([]);

  const [statusLoading, setStatusLoading] = useState(false);
  const [resolvedModel, setResolvedModel] = useState<string>('');

  const [pinnedModel, setPinnedModel] = useState<string>('');
  const [rollbackLoading, setRollbackLoading] = useState(false);

  const fetchStatus = async () => {
    setStatusLoading(true);
    try {
      const s: any = await api('/ai/models/status');
      setResolvedModel(pickResolvedModel(s, provider));
    } catch {
      setResolvedModel('');
    } finally {
      setStatusLoading(false);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const r: any = await api(`/owner/ai-model-log?provider=${encodeURIComponent(provider)}&limit=${encodeURIComponent(String(limit))}`);
      const items = Array.isArray(r?.items) ? r.items : Array.isArray(r) ? r : [];
      setRows(items.map(normalizeLogRow));
    } catch (e: any) {
      setRows([]);
      notify.err('Failed to load model logs', e?.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const refreshAll = async () => {
    await Promise.allSettled([fetchStatus(), fetchLogs()]);
  };

  useEffect(() => {
    void refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  const onRollback = async () => {
    const model = (pinnedModel || '').trim();
    if (!model) {
      notify.err('Pinned model required', 'Enter a pinned model first');
      return;
    }

    setRollbackLoading(true);
    try {
      await api('/owner/ai-model-rollback', {
        method: 'POST',
        json: {
          provider,
          pinnedModel: model,
          reason: 'Founder rollback to pinned model (Safe Owner Zone)',
        },
        ownerUnlockToken: getOwnerUnlockToken(),
      });
      notify.ok('Rollback requested', `${provider.toUpperCase()} pinned to ${model}`);
      await refreshAll();
    } catch (e: any) {
      notify.err('Rollback failed', e?.message || 'Unknown error');
    } finally {
      setRollbackLoading(false);
    }
  };

  const providerTabs: Array<{ key: ProviderKey; label: string }> = [
    { key: 'openai', label: 'OpenAI' },
    { key: 'gemini', label: 'Gemini' },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-lg font-semibold">AI Model Change Log</div>
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Model resolution and change history (OpenAI/Gemini) with founder rollback.
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {providerTabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setProvider(t.key)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  provider === t.key
                    ? 'border-slate-300 bg-slate-100 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                {t.label}
              </button>
            ))}

            <button
              type="button"
              onClick={() => void refreshAll()}
              disabled={loading || statusLoading}
              className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              {(loading || statusLoading) ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Resolved model: {statusLoading ? 'Loading...' : (resolvedModel || '—')}
        </div>
      </div>

      {isFounder ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="text-lg font-semibold">Rollback to pinned model</div>
          <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Founder-only. Requires Owner Key unlock.
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr,auto] md:items-end">
            <div>
              <label className="block text-sm font-medium mb-1">Pinned model</label>
              <input
                value={pinnedModel}
                onChange={(e) => setPinnedModel(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                placeholder={provider === 'openai' ? 'e.g., gpt-5.2' : 'e.g., gemini-pro-latest'}
              />
              {!canUseDangerActions ? (
                <div className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                  Unlock Owner Key on the Hub to enable rollback.
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => void onRollback()}
              disabled={rollbackLoading || busy || !canUseDangerActions}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
            >
              {rollbackLoading ? 'Rolling back...' : 'Rollback Now'}
            </button>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">Change history</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Showing up to {limit} entries</div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <th className="border-b border-slate-200 px-3 py-2 dark:border-slate-700">Date/Time</th>
                <th className="border-b border-slate-200 px-3 py-2 dark:border-slate-700">Reason</th>
                <th className="border-b border-slate-200 px-3 py-2 dark:border-slate-700">Mode (before → after)</th>
                <th className="border-b border-slate-200 px-3 py-2 dark:border-slate-700">Model (before → after)</th>
                <th className="border-b border-slate-200 px-3 py-2 dark:border-slate-700">Changed By</th>
                <th className="border-b border-slate-200 px-3 py-2 dark:border-slate-700">IP</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-sm text-slate-600 dark:text-slate-300">
                    Loading...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-sm text-slate-600 dark:text-slate-300">
                    No log entries.
                  </td>
                </tr>
              ) : (
                rows.map((r, idx) => (
                  <tr key={idx} className="text-sm">
                    <td className="border-b border-slate-100 px-3 py-2 align-top dark:border-slate-800">{formatDateTime(r.at)}</td>
                    <td className="border-b border-slate-100 px-3 py-2 align-top dark:border-slate-800">{r.reason || '—'}</td>
                    <td className="border-b border-slate-100 px-3 py-2 align-top dark:border-slate-800">
                      {(r.modeBefore || '—')} → {(r.modeAfter || '—')}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2 align-top dark:border-slate-800">
                      {(r.modelBefore || '—')} → {(r.modelAfter || '—')}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2 align-top dark:border-slate-800">{r.changedBy || '—'}</td>
                    <td className="border-b border-slate-100 px-3 py-2 align-top dark:border-slate-800">{r.ip || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
