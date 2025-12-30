import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Switch from '@/components/settings/Switch';
import {
  addTrendingTopic,
  deleteTrendingTopic,
  listTrendingTopics,
  patchTrendingTopic,
  resetTrendingTopics,
  type TrendingTopic,
} from '@/lib/api/trendingTopics';

type Draft = {
  label: string;
  href: string;
  colorKey: string;
};

function clampHref(input: string): string {
  const s = (input || '').trim();
  if (!s) return '';
  // Allow relative URLs like '/topic/xyz' and absolute.
  return s;
}

export default function TrendingTopicsManager() {
  const [items, setItems] = useState<TrendingTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [createDraft, setCreateDraft] = useState<Draft>({ label: '', href: '', colorKey: '' });

  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>({ label: '', href: '', colorKey: '' });

  async function reload() {
    setLoading(true);
    try {
      const list = await listTrendingTopics();
      setItems(list);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load trending topics');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sorted = useMemo(() => {
    const copy = [...items];
    copy.sort((a, b) => (a.order - b.order) || a.label.localeCompare(b.label));
    return copy;
  }, [items]);

  function beginEdit(t: TrendingTopic) {
    setEditId(t.id);
    setEditDraft({ label: t.label, href: t.href, colorKey: t.colorKey });
  }

  function cancelEdit() {
    setEditId(null);
    setEditDraft({ label: '', href: '', colorKey: '' });
  }

  async function move(id: string, dir: -1 | 1) {
    const idx = sorted.findIndex((t) => t.id === id);
    if (idx < 0) return;
    const other = sorted[idx + dir];
    if (!other) return;

    const a = sorted[idx];
    const b = other;

    setBusyId(id);
    try {
      // Swap order numbers (patch both to keep backend consistent)
      await patchTrendingTopic(a.id, { order: b.order });
      await patchTrendingTopic(b.id, { order: a.order });
      toast.success('Reordered');
      await reload();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to reorder');
    } finally {
      setBusyId(null);
    }
  }

  async function toggleEnabled(t: TrendingTopic, next: boolean) {
    setBusyId(t.id);
    try {
      await patchTrendingTopic(t.id, { enabled: next });
      setItems((prev) => prev.map((x) => (x.id === t.id ? { ...x, enabled: next } : x)));
      toast.success(next ? 'Enabled' : 'Disabled');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update');
    } finally {
      setBusyId(null);
    }
  }

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    const label = createDraft.label.trim();
    const href = clampHref(createDraft.href);
    const colorKey = createDraft.colorKey.trim();

    if (!label) {
      toast.error('Label is required');
      return;
    }
    if (!href) {
      toast.error('Href is required');
      return;
    }
    if (!colorKey) {
      toast.error('Color is required');
      return;
    }

    setBusyId('__create__');
    try {
      await addTrendingTopic({ label, href, colorKey });
      toast.success('Topic added');
      setCreateDraft({ label: '', href: '', colorKey: '' });
      await reload();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to add topic');
    } finally {
      setBusyId(null);
    }
  }

  async function submitEdit(id: string) {
    const label = editDraft.label.trim();
    const href = clampHref(editDraft.href);
    const colorKey = editDraft.colorKey.trim();

    if (!label) {
      toast.error('Label is required');
      return;
    }
    if (!href) {
      toast.error('Href is required');
      return;
    }
    if (!colorKey) {
      toast.error('Color is required');
      return;
    }

    setBusyId(id);
    try {
      await patchTrendingTopic(id, { label, href, colorKey });
      toast.success('Saved');
      cancelEdit();
      await reload();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save');
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this topic?')) return;
    setBusyId(id);
    try {
      await deleteTrendingTopic(id);
      toast.success('Deleted');
      if (editId === id) cancelEdit();
      await reload();
    } catch (e: any) {
      toast.error(e?.message || 'Delete failed');
    } finally {
      setBusyId(null);
    }
  }

  async function resetDefaults() {
    if (!window.confirm('Reset trending topics to defaults? This will overwrite current list.')) return;
    setBusyId('__reset__');
    try {
      await resetTrendingTopics();
      toast.success('Reset to defaults');
      if (editId) cancelEdit();
      await reload();
    } catch (e: any) {
      toast.error(e?.message || 'Reset failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-lg font-semibold">Trending Topics</div>
            <div className="mt-1 text-sm text-slate-600">
              Manage the topics shown on the public site trending strip.
            </div>
          </div>

          <button
            type="button"
            onClick={resetDefaults}
            disabled={busyId === '__reset__' || loading}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100 disabled:opacity-60"
            title="Reset to backend defaults"
          >
            Reset to Default
          </button>
        </div>
      </div>

      <form onSubmit={submitCreate} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-base font-semibold">Add Topic</div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-12 gap-3">
          <label className="md:col-span-4">
            <div className="text-xs font-semibold text-slate-600">Label</div>
            <input
              className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
              value={createDraft.label}
              onChange={(e) => setCreateDraft((d) => ({ ...d, label: e.target.value }))}
              placeholder="e.g., Elections"
            />
          </label>

          <label className="md:col-span-5">
            <div className="text-xs font-semibold text-slate-600">Href</div>
            <input
              className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
              value={createDraft.href}
              onChange={(e) => setCreateDraft((d) => ({ ...d, href: e.target.value }))}
              placeholder="e.g., /search?topic=elections"
            />
          </label>

          <label className="md:col-span-3">
            <div className="text-xs font-semibold text-slate-600">Color</div>
            <input
              className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
              value={createDraft.colorKey}
              onChange={(e) => setCreateDraft((d) => ({ ...d, colorKey: e.target.value }))}
              placeholder="e.g., red"
            />
          </label>

          <div className="md:col-span-12 flex justify-end">
            <button
              type="submit"
              disabled={busyId === '__create__' || loading}
              className="rounded-lg border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              Add
            </button>
          </div>
        </div>
      </form>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-base font-semibold">Topics</div>
        <div className="mt-1 text-sm text-slate-600">Reorder using Up/Down. Toggle Enabled anytime.</div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b">
                <th className="py-2 pr-3">Order</th>
                <th className="py-2 pr-3">Label</th>
                <th className="py-2 pr-3">Href</th>
                <th className="py-2 pr-3">Color</th>
                <th className="py-2 pr-3">Enabled</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="py-4 text-slate-600" colSpan={6}>Loading…</td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td className="py-4 text-slate-600" colSpan={6}>No trending topics yet.</td>
                </tr>
              ) : (
                sorted.map((t, index) => {
                  const isEditing = editId === t.id;
                  const busy = busyId === t.id;

                  return (
                    <tr key={t.id} className="border-b last:border-b-0">
                      <td className="py-3 pr-3 align-top">
                        <div className="flex items-center gap-2">
                          <div className="w-10 text-slate-700">{t.order}</div>
                          <div className="flex flex-col gap-1">
                            <button
                              type="button"
                              onClick={() => move(t.id, -1)}
                              disabled={busy || index === 0}
                              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-100 disabled:opacity-50"
                            >
                              Up
                            </button>
                            <button
                              type="button"
                              onClick={() => move(t.id, 1)}
                              disabled={busy || index === sorted.length - 1}
                              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-100 disabled:opacity-50"
                            >
                              Down
                            </button>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 pr-3 align-top">
                        {isEditing ? (
                          <input
                            className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm"
                            value={editDraft.label}
                            onChange={(e) => setEditDraft((d) => ({ ...d, label: e.target.value }))}
                          />
                        ) : (
                          <div className="font-semibold text-slate-900">{t.label}</div>
                        )}
                      </td>

                      <td className="py-3 pr-3 align-top">
                        {isEditing ? (
                          <input
                            className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm"
                            value={editDraft.href}
                            onChange={(e) => setEditDraft((d) => ({ ...d, href: e.target.value }))}
                          />
                        ) : (
                          <div className="text-slate-700 break-all">{t.href}</div>
                        )}
                      </td>

                      <td className="py-3 pr-3 align-top">
                        {isEditing ? (
                          <input
                            className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm"
                            value={editDraft.colorKey}
                            onChange={(e) => setEditDraft((d) => ({ ...d, colorKey: e.target.value }))}
                          />
                        ) : (
                          <div className="text-slate-700">{t.colorKey || '—'}</div>
                        )}
                      </td>

                      <td className="py-3 pr-3 align-top">
                        <Switch
                          checked={!!t.enabled}
                          onCheckedChange={(v) => toggleEnabled(t, v)}
                          disabled={busy}
                          label={t.label}
                        />
                      </td>

                      <td className="py-3 align-top">
                        {isEditing ? (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => submitEdit(t.id)}
                              disabled={busy}
                              className="rounded border border-slate-900 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              disabled={busy}
                              className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-slate-100 disabled:opacity-60"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => beginEdit(t)}
                              disabled={busyId !== null}
                              className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-slate-100 disabled:opacity-60"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => remove(t.id)}
                              disabled={busy}
                              className="rounded border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
