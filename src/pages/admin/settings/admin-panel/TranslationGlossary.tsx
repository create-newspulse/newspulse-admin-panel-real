import { useEffect, useMemo, useState } from 'react';

import { getTranslationGlossary, putTranslationGlossary, type GlossaryEntry } from '@/api/translationGlossary';
import { normalizeError } from '@/lib/error';

function makeId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `g_${Math.random().toString(16).slice(2)}_${Date.now()}`;
  }
}

export default function TranslationGlossary() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<GlossaryEntry[]>([]);
  const [baseKey, setBaseKey] = useState('');

  const dirty = useMemo(() => {
    const key = JSON.stringify(items);
    return !!baseKey && key !== baseKey;
  }, [items, baseKey]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const loaded = await getTranslationGlossary();
        if (!mounted) return;
        setItems(loaded);
        setBaseKey(JSON.stringify(loaded));
        setError(null);
      } catch (e: any) {
        if (!mounted) return;
        setError(normalizeError(e, 'Failed to load glossary').message);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const onAdd = () => {
    setItems((prev) => [
      {
        id: makeId(),
        term: '',
        hi: '',
        gu: '',
      },
      ...prev,
    ]);
  };

  const onSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const cleaned = items
        .map((it) => ({
          ...it,
          term: String(it.term || '').trim(),
          hi: String(it.hi || '').trim(),
          gu: String(it.gu || '').trim(),
        }))
        .filter((it) => it.term);

      const saved = await putTranslationGlossary(cleaned);
      setItems(saved);
      setBaseKey(JSON.stringify(saved));
      setError(null);
    } catch (e: any) {
      setError(normalizeError(e, 'Failed to save glossary').message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm text-slate-500">Admin Panel Settings</div>
        <h2 className="text-xl font-semibold">Glossary / Protected Terms</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Protect brand terms and phrases from mistranslation. These mappings are applied during ticker translation.
        </p>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-semibold text-slate-900 dark:text-white">Entries</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
              onClick={onAdd}
              disabled={loading || saving}
            >
              Add term
            </button>
            <button
              type="button"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              onClick={onSave}
              disabled={loading || saving || !dirty}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="mt-4 text-sm text-slate-600 dark:text-slate-300">Loading…</div>
        ) : items.length === 0 ? (
          <div className="mt-4 text-sm text-slate-600 dark:text-slate-300">No glossary entries yet.</div>
        ) : (
          <div className="mt-4 space-y-3">
            {items.map((it) => (
              <div
                key={it.id}
                className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700 md:grid-cols-12 md:items-center"
              >
                <div className="md:col-span-4">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400">Term (source)</label>
                  <input
                    value={it.term}
                    onChange={(e) => {
                      const v = e.target.value;
                      setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, term: v } : x)));
                    }}
                    placeholder="Donkey Route"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400">Hindi</label>
                  <input
                    value={it.hi}
                    onChange={(e) => {
                      const v = e.target.value;
                      setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, hi: v } : x)));
                    }}
                    placeholder="डोंकी रूट"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400">Gujarati</label>
                  <input
                    value={it.gu}
                    onChange={(e) => {
                      const v = e.target.value;
                      setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, gu: v } : x)));
                    }}
                    placeholder="ડોન્કી રૂટ"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>

                <div className="md:col-span-2 md:flex md:justify-end">
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
                    onClick={() => setItems((prev) => prev.filter((x) => x.id !== it.id))}
                    disabled={saving}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 text-xs text-slate-500 dark:text-slate-400">
          Example: <span className="font-mono">Donkey Route → ડોન્કી રૂટ / डोंकी रूट</span>
        </div>
      </div>
    </div>
  );
}
