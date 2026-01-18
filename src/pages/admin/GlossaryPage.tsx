import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNotify } from '@/components/ui/toast-bridge';
import ConfirmModal from '@/components/ui/ConfirmModal';
import {
  type GlossaryEntry,
  createGlossary,
  deleteGlossary,
  listGlossary,
  updateGlossary,
} from '@/api/glossary';

type Lang = 'en' | 'hi' | 'gu';

type CsvRow = {
  key: string;
  en?: string;
  hi?: string;
  gu?: string;
  doNotTranslate?: boolean;
  preferredEn?: string;
  preferredHi?: string;
  preferredGu?: string;
};

function cleanKey(input: string) {
  return (input || '').trim();
}

function cleanText(input: string) {
  const s = (input || '').toString();
  const trimmed = s.trim();
  return trimmed;
}

function hasAnyTranslation(e: Pick<GlossaryEntry, 'en' | 'hi' | 'gu'>) {
  return !!(cleanText(e.en || '') || cleanText(e.hi || '') || cleanText(e.gu || ''));
}

function escapeCsvCell(input: unknown) {
  const s = String(input ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows: CsvRow[]) {
  const header = ['key', 'en', 'hi', 'gu', 'doNotTranslate', 'preferred_en', 'preferred_hi', 'preferred_gu'];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([
      escapeCsvCell(r.key),
      escapeCsvCell(r.en || ''),
      escapeCsvCell(r.hi || ''),
      escapeCsvCell(r.gu || ''),
      escapeCsvCell(r.doNotTranslate ? 'true' : 'false'),
      escapeCsvCell(r.preferredEn || ''),
      escapeCsvCell(r.preferredHi || ''),
      escapeCsvCell(r.preferredGu || ''),
    ].join(','));
  }
  return lines.join('\n');
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  const s = String(text || '');
  let row: string[] = [];
  let cell = '';
  let i = 0;
  let inQuotes = false;

  const pushCell = () => {
    row.push(cell);
    cell = '';
  };
  const pushRow = () => {
    // Avoid a trailing empty row
    if (row.length === 1 && row[0] === '' && rows.length > 0) {
      row = [];
      return;
    }
    rows.push(row);
    row = [];
  };

  while (i < s.length) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        const next = s[i + 1];
        if (next === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cell += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ',') {
      pushCell();
      i += 1;
      continue;
    }
    if (ch === '\n') {
      pushCell();
      pushRow();
      i += 1;
      continue;
    }
    if (ch === '\r') {
      // swallow CR
      i += 1;
      continue;
    }
    cell += ch;
    i += 1;
  }
  pushCell();
  pushRow();
  return rows;
}

function downloadText(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
  if (typeof window === 'undefined') return;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function uniq(arr: string[]) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of arr) {
    const k = String(x || '').trim();
    if (!k) continue;
    const key = k.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(k);
  }
  return out;
}

function extractLockedEntities(text: string): string[] {
  const t = String(text || '');
  const urls = t.match(/https?:\/\/[^\s)\]]+/gi) || [];
  const emails = t.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) || [];
  const hashtags = t.match(/#[\p{L}\p{N}_]+/gu) || [];
  const mentions = t.match(/@[\p{L}\p{N}_]+/gu) || [];
  const numbers = t.match(/\b\d+(?:[.,]\d+)?\b/g) || [];
  return uniq([...urls, ...emails, ...hashtags, ...mentions, ...numbers]);
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function applyGlossaryReplacements(input: string, entries: GlossaryEntry[], targetLang: Lang): { output: string; matches: Array<{ key: string; from: string; to: string }>} {
  const text = String(input || '');
  const matches: Array<{ key: string; from: string; to: string }> = [];

  // Replace using EN phrases as the match base (best-effort sandbox).
  const candidates = (entries || [])
    .map((e) => {
      const from = String(e.en || '').trim();
      const preferred = String(e.preferredTerms?.[targetLang] || '').trim();
      const fallback = String((e as any)[targetLang] || '').trim();
      const to = preferred || fallback;
      return { key: e.key, from, to, doNotTranslate: !!e.doNotTranslate };
    })
    .filter((c) => c.from && c.to && !c.doNotTranslate);

  // Longest-first to reduce overlap issues.
  candidates.sort((a, b) => b.from.length - a.from.length);

  let out = text;
  for (const c of candidates) {
    const re = new RegExp(escapeRegExp(c.from), 'g');
    if (!re.test(out)) continue;
    out = out.replace(re, c.to);
    matches.push({ key: c.key, from: c.from, to: c.to });
  }
  return { output: out, matches };
}

function GlossaryModal(props: {
  open: boolean;
  title: string;
  value: GlossaryEntry;
  onChange: (next: GlossaryEntry) => void;
  onCancel: () => void;
  onSave: () => void;
  saving?: boolean;
  error?: string | null;
}) {
  if (!props.open) return null;

  const v = props.value;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="max-w-2xl mx-auto bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 shadow-lg">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
          <div className="font-semibold text-slate-900 dark:text-slate-100">{props.title}</div>
          <button
            type="button"
            className="text-sm px-3 py-1.5 rounded border bg-white hover:bg-slate-50 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-900"
            onClick={props.onCancel}
          >
            Close
          </button>
        </div>

        <div className="px-4 py-4 space-y-4">
          {props.error ? (
            <div className="text-sm text-red-600 dark:text-red-300 rounded border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/10 px-3 py-2">
              {props.error}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">Key</label>
              <input
                value={v.key}
                onChange={(e) => props.onChange({ ...v, key: e.target.value })}
                placeholder="e.g. breaking_ticker"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
              <div className="text-xs text-slate-500 dark:text-slate-400">Required. Use stable snake_case keys.</div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">Do Not Translate</label>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={!!v.doNotTranslate}
                  onChange={(e) => props.onChange({ ...v, doNotTranslate: e.target.checked })}
                />
                Keep as-is across languages
              </label>
              <div className="text-xs text-slate-500 dark:text-slate-400">If enabled, translation pipeline should skip this key.</div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">English (en)</label>
              <textarea
                rows={3}
                value={v.en || ''}
                onChange={(e) => props.onChange({ ...v, en: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">Hindi (hi)</label>
              <textarea
                rows={3}
                value={v.hi || ''}
                onChange={(e) => props.onChange({ ...v, hi: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">Gujarati (gu)</label>
              <textarea
                rows={3}
                value={v.gu || ''}
                onChange={(e) => props.onChange({ ...v, gu: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">Preferred Terms (optional)</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">If set, translation should prefer these terms for each language.</div>
            <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">Preferred en</label>
                <input
                  value={v.preferredTerms?.en || ''}
                  onChange={(e) => props.onChange({ ...v, preferredTerms: { ...(v.preferredTerms || {}), en: e.target.value } })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                  placeholder="Optional preferred English term"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">Preferred hi</label>
                <input
                  value={v.preferredTerms?.hi || ''}
                  onChange={(e) => props.onChange({ ...v, preferredTerms: { ...(v.preferredTerms || {}), hi: e.target.value } })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                  placeholder="Optional preferred Hindi term"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">Preferred gu</label>
                <input
                  value={v.preferredTerms?.gu || ''}
                  onChange={(e) => props.onChange({ ...v, preferredTerms: { ...(v.preferredTerms || {}), gu: e.target.value } })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                  placeholder="Optional preferred Gujarati term"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-2">
          <button
            type="button"
            className="text-sm px-3 py-2 rounded border bg-white hover:bg-slate-50 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-900"
            onClick={props.onCancel}
            disabled={!!props.saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            onClick={props.onSave}
            disabled={!!props.saving}
          >
            {props.saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function GlossaryPage() {
  const notify = useNotify();
  const notifyRef = useRef(notify);
  useEffect(() => { notifyRef.current = notify; }, [notify]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState('');
  const [dntFilter, setDntFilter] = useState<'all' | 'dnt' | 'translatable'>('all');
  const [items, setItems] = useState<GlossaryEntry[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [draft, setDraft] = useState<GlossaryEntry>({ key: '', en: '', hi: '', gu: '', preferredTerms: {}, doNotTranslate: false });
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<GlossaryEntry | null>(null);

  // Power tools
  const [toolsTab, setToolsTab] = useState<'entries' | 'tools'>('entries');
  const [importing, setImporting] = useState(false);
  const importAllRowsRef = useRef<CsvRow[]>([]);
  const [importPreviewRows, setImportPreviewRows] = useState<CsvRow[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [sandboxLang, setSandboxLang] = useState<Lang>('hi');
  const [sandboxInput, setSandboxInput] = useState('');

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = items.filter((it) => {
      if (dntFilter === 'dnt') return !!it.doNotTranslate;
      if (dntFilter === 'translatable') return !it.doNotTranslate;
      return true;
    });
    if (!needle) return filtered;
    return filtered.filter((it) => {
      const hay = [
        it.key,
        it.en,
        it.hi,
        it.gu,
        it.preferredTerms?.en,
        it.preferredTerms?.hi,
        it.preferredTerms?.gu,
      ].map((x) => String(x || '').toLowerCase()).join('\n');
      return hay.includes(needle);
    });
  }, [dntFilter, items, q]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await listGlossary({ q });
      setItems(data);
    } catch (e: any) {
      notifyRef.current.err('Failed to load glossary', e?.message || 'API error');
    } finally {
      setRefreshing(false);
    }
  }, [q]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await listGlossary({ q: '' });
        if (mounted) setItems(data);
      } catch (e: any) {
        notifyRef.current.err('Failed to load glossary', e?.message || 'API error');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const openCreate = () => {
    setModalMode('create');
    setDraft({ key: '', en: '', hi: '', gu: '', preferredTerms: {}, doNotTranslate: false });
    setModalError(null);
    setModalOpen(true);
  };

  const openEdit = (it: GlossaryEntry) => {
    setModalMode('edit');
    setDraft({ ...it });
    setModalError(null);
    setModalOpen(true);
  };

  const validateDraft = (): string | null => {
    const key = cleanKey(draft.key);
    if (!key) return 'Key is required.';
    if (!draft.doNotTranslate && !hasAnyTranslation(draft)) return 'At least one translation (en/hi/gu) is required (unless Do Not Translate is enabled).';
    return null;
  };

  const save = async () => {
    const err = validateDraft();
    if (err) {
      setModalError(err);
      return;
    }

    setSaving(true);
    setModalError(null);
    try {
      const preferredEn = cleanText(draft.preferredTerms?.en || '') || undefined;
      const preferredHi = cleanText(draft.preferredTerms?.hi || '') || undefined;
      const preferredGu = cleanText(draft.preferredTerms?.gu || '') || undefined;
      const payload: GlossaryEntry = {
        ...draft,
        key: cleanKey(draft.key),
        en: cleanText(draft.en || ''),
        hi: cleanText(draft.hi || ''),
        gu: cleanText(draft.gu || ''),
        preferredTerms: preferredEn || preferredHi || preferredGu ? { en: preferredEn, hi: preferredHi, gu: preferredGu } : undefined,
        doNotTranslate: !!draft.doNotTranslate,
      };

      if (modalMode === 'create') {
        await createGlossary(payload as any);
        notifyRef.current.ok('Created ✅');
      } else {
        await updateGlossary(payload);
        notifyRef.current.ok('Updated ✅');
      }

      setModalOpen(false);
      await refresh();
    } catch (e: any) {
      setModalError(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const askDelete = (it: GlossaryEntry) => {
    setPendingDelete(it);
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setConfirmOpen(false);
    try {
      await deleteGlossary(pendingDelete);
      notifyRef.current.ok('Deleted ✅');
      await refresh();
    } catch (e: any) {
      notifyRef.current.err('Delete failed', e?.message || 'API error');
    } finally {
      setPendingDelete(null);
    }
  };

  const langCells = (it: GlossaryEntry, lang: Lang) => {
    const val = (it as any)[lang];
    const s = String(val || '').trim();
    const preferred = String(it.preferredTerms?.[lang] || '').trim();

    if (!s && !preferred) return <span className="text-slate-400">—</span>;
    return (
      <div className="space-y-1">
        {s ? <div>{s}</div> : null}
        {preferred ? (
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Preferred: <span className="text-slate-700 dark:text-slate-200">{preferred}</span>
          </div>
        ) : null}
      </div>
    );
  };

  const onPickCsv = async (file: File | null) => {
    setImportError(null);
    importAllRowsRef.current = [];
    setImportPreviewRows([]);
    setImportFileName(file ? file.name : '');
    if (!file) return;

    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) {
        setImportError('CSV is empty');
        return;
      }
      const header = rows[0].map((h) => String(h || '').trim().toLowerCase());
      const idx = (name: string) => header.indexOf(name);
      const keyIdx = idx('key');
      if (keyIdx < 0) {
        setImportError('CSV header must include: key (and optionally en,hi,gu,doNotTranslate,preferred_en,preferred_hi,preferred_gu)');
        return;
      }

      const out: CsvRow[] = [];
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        const key = cleanKey(r[keyIdx] || '');
        if (!key) continue;

        const en = cleanText(r[idx('en')] || '');
        const hi = cleanText(r[idx('hi')] || '');
        const gu = cleanText(r[idx('gu')] || '');
        const dntRaw = String(r[idx('donottranslate')] ?? r[idx('do_not_translate')] ?? r[idx('noTranslate')] ?? '').trim().toLowerCase();
        const doNotTranslate = dntRaw === 'true' || dntRaw === '1' || dntRaw === 'yes' || dntRaw === 'y';

        const preferredEn = cleanText(r[idx('preferred_en')] ?? r[idx('preferreden')] ?? r[idx('preferred.en')] ?? '');
        const preferredHi = cleanText(r[idx('preferred_hi')] ?? r[idx('preferredhi')] ?? r[idx('preferred.hi')] ?? '');
        const preferredGu = cleanText(r[idx('preferred_gu')] ?? r[idx('preferredgu')] ?? r[idx('preferred.gu')] ?? '');

        out.push({
          key,
          en: en || undefined,
          hi: hi || undefined,
          gu: gu || undefined,
          doNotTranslate,
          preferredEn: preferredEn || undefined,
          preferredHi: preferredHi || undefined,
          preferredGu: preferredGu || undefined,
        });
      }

      if (out.length === 0) {
        setImportError('No valid data rows found');
        return;
      }
      importAllRowsRef.current = out;
      setImportPreviewRows(out.slice(0, 500));
      if (out.length > 500) {
        notifyRef.current.ok('Loaded CSV ✅');
      }
    } catch (e: any) {
      setImportError(e?.message || 'Failed to parse CSV');
    }
  };

  const importCsv = async () => {
    const all = importAllRowsRef.current || [];
    if (!importFileName || all.length === 0) {
      notifyRef.current.err('No CSV loaded', 'Pick a CSV file first.');
      return;
    }
    setImporting(true);
    setImportError(null);

    try {
      // Re-read the file via the input is not reliable; we import what we parsed.
      const byKey = new Map<string, GlossaryEntry>();
      for (const it of items) byKey.set(String(it.key || '').trim(), it);

      let created = 0;
      let updated = 0;
      let skipped = 0;

      // Small pool to avoid hammering backend.
      const concurrency = 4;
      const queue = all.slice();
      const workers = new Array(concurrency).fill(0).map(async () => {
        while (queue.length) {
          const row = queue.shift();
          if (!row) break;
          const key = cleanKey(row.key);
          if (!key) { skipped++; continue; }

          const payload: GlossaryEntry = {
            key,
            en: row.en,
            hi: row.hi,
            gu: row.gu,
            preferredTerms: (row.preferredEn || row.preferredHi || row.preferredGu)
              ? { en: row.preferredEn, hi: row.preferredHi, gu: row.preferredGu }
              : undefined,
            doNotTranslate: !!row.doNotTranslate,
          };

          if (!payload.doNotTranslate && !hasAnyTranslation(payload)) { skipped++; continue; }

          const existing = byKey.get(key);
          if (existing) {
            await updateGlossary({ ...existing, ...payload });
            updated++;
          } else {
            await createGlossary(payload as any);
            created++;
          }
        }
      });

      await Promise.all(workers);
      notifyRef.current.ok(`Imported ✅ (created ${created}, updated ${updated}, skipped ${skipped})`);
      await refresh();
    } catch (e: any) {
      setImportError(e?.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const exportCsv = (which: 'all' | 'visible') => {
    const rows = (which === 'all' ? items : visible).map((it) => ({
      key: it.key,
      en: it.en,
      hi: it.hi,
      gu: it.gu,
      doNotTranslate: !!it.doNotTranslate,
      preferredEn: it.preferredTerms?.en,
      preferredHi: it.preferredTerms?.hi,
      preferredGu: it.preferredTerms?.gu,
    }));
    const csv = toCsv(rows);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadText(`glossary-${which}-${stamp}.csv`, csv, 'text/csv;charset=utf-8');
  };

  const sandbox = useMemo(() => {
    const locked = extractLockedEntities(sandboxInput);
    const applied = applyGlossaryReplacements(sandboxInput, items, sandboxLang);
    return { locked, ...applied };
  }, [items, sandboxInput, sandboxLang]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">📚 Glossary</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">Manage translation keys + values (Founder/Admin only).</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
            disabled={refreshing}
            onClick={() => refresh().catch(() => null)}
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <button
            type="button"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            onClick={openCreate}
          >
            New Entry
          </button>
        </div>
      </header>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 w-full">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by key, translation, preferred term…"
            className="w-full sm:max-w-md rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
          <select
            value={dntFilter}
            onChange={(e) => setDntFilter(e.target.value as any)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            title="Filter by Do-Not-Translate flag"
          >
            <option value="all">All</option>
            <option value="dnt">Do Not Translate</option>
            <option value="translatable">Translatable</option>
          </select>
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">Showing {visible.length} of {items.length}</div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-0 dark:border-slate-700 dark:bg-slate-900 overflow-hidden">
        {loading ? (
          <div className="p-4 text-sm text-slate-600 dark:text-slate-300">Loading…</div>
        ) : visible.length === 0 ? (
          <div className="p-4 text-sm text-slate-600 dark:text-slate-300">No entries found</div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-[900px] w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950">
                <tr className="text-left">
                  <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">Key</th>
                  <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">en</th>
                  <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">hi</th>
                  <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">gu</th>
                  <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">Flags</th>
                  <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {visible.map((it) => (
                  <tr key={it.id || it._id || it.key} className="align-top">
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">{it.key}</td>
                    <td className="px-4 py-3 text-slate-800 dark:text-slate-200">{langCells(it, 'en')}</td>
                    <td className="px-4 py-3 text-slate-800 dark:text-slate-200">{langCells(it, 'hi')}</td>
                    <td className="px-4 py-3 text-slate-800 dark:text-slate-200">{langCells(it, 'gu')}</td>
                    <td className="px-4 py-3">
                      {it.doNotTranslate ? (
                        <span className="inline-flex items-center rounded-full border border-slate-200 dark:border-slate-700 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200">DO_NOT_TRANSLATE</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          className="text-xs px-3 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
                          onClick={() => openEdit(it)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="text-xs px-3 py-1.5 rounded border border-red-200 bg-red-50 hover:bg-red-100 text-red-800 dark:border-red-800/40 dark:bg-red-900/10 dark:text-red-200 dark:hover:bg-red-900/20"
                          onClick={() => askDelete(it)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={
            toolsTab === 'entries'
              ? 'rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900'
              : 'rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800'
          }
          onClick={() => setToolsTab('entries')}
        >
          Entries
        </button>
        <button
          type="button"
          className={
            toolsTab === 'tools'
              ? 'rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900'
              : 'rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800'
          }
          onClick={() => setToolsTab('tools')}
        >
          Power Tools
        </button>
      </div>

      {toolsTab === 'tools' ? (
        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-semibold text-slate-900 dark:text-slate-100">CSV Import / Export</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Header: key,en,hi,gu,doNotTranslate,preferred_en,preferred_hi,preferred_gu</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="text-sm px-3 py-2 rounded border border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
                  onClick={() => exportCsv('all')}
                >
                  Export all
                </button>
                <button
                  type="button"
                  className="text-sm px-3 py-2 rounded border border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
                  onClick={() => exportCsv('visible')}
                >
                  Export visible
                </button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => { void onPickCsv(e.target.files?.[0] || null); }}
                  className="block w-full text-sm"
                />
                {importFileName ? (
                  <div className="text-xs text-slate-500 dark:text-slate-400">Loaded: {importFileName} (rows: {importAllRowsRef.current.length})</div>
                ) : (
                  <div className="text-xs text-slate-500 dark:text-slate-400">Pick a CSV file to preview and import.</div>
                )}
                {importError ? (
                  <div className="text-sm text-red-600 dark:text-red-300">{importError}</div>
                ) : null}
                <button
                  type="button"
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                  disabled={importing || importAllRowsRef.current.length === 0}
                  onClick={() => { void importCsv(); }}
                >
                  {importing ? 'Importing…' : 'Import'}
                </button>
              </div>

              <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="px-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200">Preview</div>
                <div className="p-3 text-xs text-slate-700 dark:text-slate-200 space-y-1 max-h-40 overflow-auto">
                  {importPreviewRows.length === 0 ? (
                    <div className="text-slate-400">—</div>
                  ) : (
                    importPreviewRows.slice(0, 8).map((r) => (
                      <div key={r.key} className="flex flex-wrap gap-2">
                        <span className="font-semibold">{r.key}</span>
                        <span className="text-slate-500">en:</span> <span>{(r.en || '').slice(0, 40) || '—'}</span>
                        <span className="text-slate-500">hi:</span> <span>{(r.hi || '').slice(0, 40) || '—'}</span>
                        <span className="text-slate-500">gu:</span> <span>{(r.gu || '').slice(0, 40) || '—'}</span>
                        {r.doNotTranslate ? <span className="text-slate-500">(DNT)</span> : null}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-semibold text-slate-900 dark:text-slate-100">Test Translation Sandbox</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Best-effort: shows locked entities and glossary-based replacements.</div>
              </div>
              <select
                value={sandboxLang}
                onChange={(e) => setSandboxLang(e.target.value as any)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="en">en</option>
                <option value="hi">hi</option>
                <option value="gu">gu</option>
              </select>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <textarea
                  rows={8}
                  value={sandboxInput}
                  onChange={(e) => setSandboxInput(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                  placeholder="Paste source text here…"
                />
                <div className="text-xs text-slate-500 dark:text-slate-400">Locked entities</div>
                <div className="flex flex-wrap gap-1.5">
                  {sandbox.locked.length === 0 ? <span className="text-slate-400">—</span> : sandbox.locked.map((x) => (
                    <span key={x} className="inline-flex items-center rounded-full border border-slate-200 dark:border-slate-700 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200">{x}</span>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="px-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200">Glossary-applied preview</div>
                  <div className="p-3 whitespace-pre-wrap text-sm text-slate-900 dark:text-slate-100 min-h-[140px]">{sandbox.output || '—'}</div>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Matched entries</div>
                <div className="space-y-1 max-h-32 overflow-auto">
                  {sandbox.matches.length === 0 ? (
                    <div className="text-sm text-slate-400">—</div>
                  ) : (
                    sandbox.matches.slice(0, 20).map((m) => (
                      <div key={`${m.key}:${m.from}`} className="text-xs text-slate-700 dark:text-slate-200">
                        <span className="font-semibold">{m.key}</span>: “{m.from}” → “{m.to}”
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      <GlossaryModal
        open={modalOpen}
        title={modalMode === 'create' ? 'New Glossary Entry' : 'Edit Glossary Entry'}
        value={draft}
        onChange={setDraft}
        onCancel={() => { if (!saving) setModalOpen(false); }}
        onSave={() => { if (!saving) void save(); }}
        saving={saving}
        error={modalError}
      />

      <ConfirmModal
        open={confirmOpen}
        title="Delete glossary entry?"
        description={pendingDelete ? `This will permanently delete: ${pendingDelete.key}` : undefined}
        confirmLabel="Delete"
        onConfirm={() => { void confirmDelete(); }}
        onCancel={() => { setConfirmOpen(false); setPendingDelete(null); }}
      />
    </div>
  );
}
