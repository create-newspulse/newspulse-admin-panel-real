import { useEffect, useMemo, useState } from 'react';
import translationHealthApi, { type TranslationHealth } from '@/lib/api/translationHealth';

function yesNo(v: boolean | undefined) {
  if (typeof v !== 'boolean') return '—';
  return v ? 'Yes' : 'No';
}

function onOff(v: boolean | undefined) {
  if (typeof v !== 'boolean') return '—';
  return v ? 'ON' : 'OFF';
}

export default function TranslationHealthCard() {
  const [data, setData] = useState<TranslationHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statusLine = useMemo(() => {
    const translation = data?.googleKeyConfigured === true ? 'Translation: ON (Google)' : data?.googleKeyConfigured === false ? 'Translation: OFF' : 'Translation: —';
    const safe = `Safe Mode ${onOff(data?.safeMode)}`;
    return `${translation} / ${safe}`;
  }, [data]);

  async function refresh() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const next = await translationHealthApi.getTranslationHealth();
      setData(next);
    } catch (e: any) {
      const msg = String(e?.message || 'Failed to load translation health.');
      setError(msg);
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const next = await translationHealthApi.getTranslationHealth();
        if (!mounted) return;
        setData(next);
      } catch (e: any) {
        if (!mounted) return;
        setError(String(e?.message || 'Failed to load translation health.'));
        setData(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm text-slate-500">Status</div>
          <div className="text-lg font-semibold">Translation Health</div>
          <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{loading ? 'Checking…' : error ? 'Unavailable' : statusLine}</div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
            onClick={refresh}
            disabled={loading}
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
          {error}
        </div>
      ) : null}

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">Google key configured</div>
          <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{yesNo(data?.googleKeyConfigured)}</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">Safe Mode</div>
          <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{onOff(data?.safeMode)}</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">Cache</div>
          <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{onOff(data?.cacheEnabled)}</div>
        </div>
      </div>
    </div>
  );
}
