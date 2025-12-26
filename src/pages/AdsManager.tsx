import React from 'react';
import toast from 'react-hot-toast';

import { adminApi } from '@/lib/api';

type AdSlot = 'HOME_728x90' | 'HOME_RIGHT_300x250' | 'HOME_RIGHT_RAIL' | 'ARTICLE_INLINE';

type SponsorAd = {
  id: string;
  slot: AdSlot | string;
  title?: string | null;
  imageUrl: string;
  targetUrl?: string | null;
  clickable?: boolean | null;
  priority?: number | null;
  startAt?: string | null;
  endAt?: string | null;
  isActive: boolean;
  updatedAt?: string | null;
  createdAt?: string | null;
};

const SLOT_OPTIONS: AdSlot[] = [
  'HOME_728x90',
  'HOME_RIGHT_300x250',
  'ARTICLE_INLINE',
];

const SLOT_LABELS: Record<string, string> = {
  HOME_728x90: 'Home Banner 728×90',
  HOME_RIGHT_300x250: 'Home Right Rail 300×250',
  ARTICLE_INLINE: 'Article Inline',
  HOME_RIGHT_RAIL: 'Home Right Rail (legacy)',
};

function slotLabel(slot: string): string {
  return SLOT_LABELS[slot] || slot;
}

function safeDateLabel(value?: string | null): string {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString();
}

function toDatetimeLocalValue(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';

  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function fromDatetimeLocalValue(value: string): string | null {
  const v = (value || '').trim();
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function parseBool(value: any): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const s = value.trim().toLowerCase();
    if (s === 'true') return true;
    if (s === 'false') return false;
    if (s === '1') return true;
    if (s === '0') return false;
    if (s === 'on' || s === 'enabled' || s === 'yes') return true;
    if (s === 'off' || s === 'disabled' || s === 'no') return false;
  }
  // Default to false for unknown/undefined shapes to avoid accidental "stuck ON".
  return false;
}

type AdFormState = {
  slot: AdSlot | '';
  title: string;
  imageUrl: string;
  targetUrl: string;
  clickable: boolean;
  priority: string; // keep as string for input
  startAt: string; // datetime-local string
  endAt: string;
  isActive: boolean;
};

const emptyForm = (): AdFormState => ({
  slot: '',
  title: '',
  imageUrl: '',
  targetUrl: '',
  clickable: true,
  priority: '0',
  startAt: '',
  endAt: '',
  isActive: true,
});

function normalizeAd(raw: any): SponsorAd {
  return {
    id: String(raw?.id ?? raw?._id ?? ''),
    slot: String(raw?.slot ?? ''),
    title: raw?.title ?? null,
    imageUrl: String(raw?.imageUrl ?? raw?.image_url ?? ''),
    targetUrl: (raw?.targetUrl ?? raw?.target_url ?? null),
    clickable: (typeof raw?.clickable === 'boolean' ? raw.clickable : (typeof raw?.isClickable === 'boolean' ? raw.isClickable : null)),
    priority: raw?.priority ?? null,
    startAt: raw?.startAt ?? raw?.start_at ?? null,
    endAt: raw?.endAt ?? raw?.end_at ?? null,
    isActive: Boolean(raw?.isActive ?? raw?.active ?? false),
    updatedAt: raw?.updatedAt ?? raw?.updated ?? null,
    createdAt: raw?.createdAt ?? null,
  };
}

export default function AdsManager() {
  const [ads, setAds] = React.useState<SponsorAd[]>([]);
  const [loading, setLoading] = React.useState(false);

  type PlacementKey = 'HOME_728x90' | 'HOME_RIGHT_300x250';
  type PlacementState = Record<PlacementKey, boolean>;

  const [slotEnabled, setSlotEnabled] = React.useState<PlacementState>({
    HOME_728x90: false,
    HOME_RIGHT_300x250: false,
  });

  const [settingsLoading, setSettingsLoading] = React.useState(true);
  const [placementSaving, setPlacementSaving] = React.useState<Record<PlacementKey, boolean>>({
    HOME_728x90: false,
    HOME_RIGHT_300x250: false,
  });

  const [slotFilter, setSlotFilter] = React.useState<AdSlot | 'ALL'>('ALL');
  const [activeOnly, setActiveOnly] = React.useState(false);

  const [modalOpen, setModalOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<AdFormState>(emptyForm);

  const [rowBusy, setRowBusy] = React.useState<Record<string, boolean>>({});

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setModalOpen(true);
  };

  const openEdit = (ad: SponsorAd) => {
    setEditingId(ad.id);
    const clickable = typeof ad.clickable === 'boolean' ? ad.clickable : Boolean((ad.targetUrl || '').toString().trim());
    setForm({
      slot: (ad.slot as AdSlot) || '',
      title: String(ad.title ?? ''),
      imageUrl: ad.imageUrl || '',
      targetUrl: String(ad.targetUrl ?? ''),
      clickable,
      priority: String(ad.priority ?? 0),
      startAt: toDatetimeLocalValue(ad.startAt),
      endAt: toDatetimeLocalValue(ad.endAt),
      isActive: Boolean(ad.isActive),
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
  };

  const fetchAds = React.useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (slotFilter !== 'ALL') params.slot = slotFilter;
      if (activeOnly) params.active = 'true';

      // Backend contract: GET /api/admin/ads
      // Use adminApi so proxy/direct mode is handled and auth headers are attached.
      const res = await adminApi.get('/admin/ads', { params });
      const payload = res?.data;

      const list = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.ads)
          ? payload.ads
          : Array.isArray(payload?.data)
            ? payload.data
            : [];

      const normalized: SponsorAd[] = (list as any[])
        .map(normalizeAd)
        .filter((a: SponsorAd) => Boolean(a.id));
      setAds(normalized);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to load ads');
    } finally {
      setLoading(false);
    }
  }, [slotFilter, activeOnly]);

  const fetchAdSettings = React.useCallback(async (): Promise<PlacementState> => {
    const res = await adminApi.get('/admin/ad-settings');
    const raw = res?.data;
    const enabledRaw = (raw?.slotEnabled || raw?.data?.slotEnabled || {}) as any;
    return {
      HOME_728x90: parseBool(enabledRaw.HOME_728x90),
      HOME_RIGHT_300x250: parseBool(enabledRaw.HOME_RIGHT_300x250),
    };
  }, []);

  const updateAdSettings = React.useCallback(async (next: PlacementState): Promise<PlacementState> => {
    const res = await adminApi.put('/admin/ad-settings', { slotEnabled: next });
    const raw = res?.data;
    const enabledRaw = (raw?.slotEnabled || raw?.data?.slotEnabled || null) as any;
    if (!enabledRaw) return next;
    return {
      HOME_728x90: parseBool(enabledRaw.HOME_728x90),
      HOME_RIGHT_300x250: parseBool(enabledRaw.HOME_RIGHT_300x250),
    };
  }, []);

  const loadSettings = React.useCallback(async () => {
    // IMPORTANT: do not overwrite local state while a save is in progress.
    if (placementSaving.HOME_728x90 || placementSaving.HOME_RIGHT_300x250) return;
    setSettingsLoading(true);
    try {
      setSlotEnabled(await fetchAdSettings());
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to load ad placements');
    } finally {
      setSettingsLoading(false);
    }
  }, [fetchAdSettings, placementSaving.HOME_728x90, placementSaving.HOME_RIGHT_300x250]);

  React.useEffect(() => {
    void fetchAds();
  }, [fetchAds]);

  // IMPORTANT: load settings only once on mount.
  // Do NOT include slotEnabled in deps (would overwrite user toggles).
  React.useEffect(() => {
    void loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePlacement = async (key: PlacementKey) => {
    const prev = slotEnabled;
    const next: PlacementState = { ...slotEnabled, [key]: !slotEnabled[key] };

    // Optimistic UI
    setSlotEnabled(next);
    setPlacementSaving((s) => ({ ...s, [key]: true }));

    try {
      const saved = await updateAdSettings(next);
      setSlotEnabled(saved);
      toast.success('Saved');
    } catch (err: any) {
      setSlotEnabled(prev);
      toast.error(err?.response?.data?.message || err?.message || 'Save failed');
    } finally {
      setPlacementSaving((s) => ({ ...s, [key]: false }));
    }
  };

  const filteredAds = React.useMemo(() => {
    let list = ads;
    if (slotFilter !== 'ALL') list = list.filter(a => a.slot === slotFilter);
    if (activeOnly) list = list.filter(a => a.isActive);
    // Higher priority first; fallback stable by updatedAt
    return [...list].sort((a, b) => {
      const ap = Number(a.priority ?? 0);
      const bp = Number(b.priority ?? 0);
      if (bp !== ap) return bp - ap;
      const ad = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const bd = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return bd - ad;
    });
  }, [ads, slotFilter, activeOnly]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.slot) {
      toast.error('Slot is required');
      return;
    }
    if (!form.imageUrl.trim()) {
      toast.error('Image URL is required');
      return;
    }
    if (form.clickable && !form.targetUrl.trim()) {
      toast.error('Target URL is required when Clickable Ad is enabled');
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        slot: form.slot,
        title: form.title.trim() || undefined,
        imageUrl: form.imageUrl.trim(),
        clickable: Boolean(form.clickable),
        targetUrl: form.clickable ? form.targetUrl.trim() : null,
        priority: Number.isFinite(Number(form.priority)) ? Number(form.priority) : 0,
        startAt: fromDatetimeLocalValue(form.startAt),
        endAt: fromDatetimeLocalValue(form.endAt),
        isActive: Boolean(form.isActive),
      };

      if (editingId) {
        // PUT /api/admin/ads/:id
        await adminApi.put(`/admin/ads/${editingId}`, payload);
        toast.success('Ad updated');
      } else {
        // POST /api/admin/ads
        await adminApi.post('/admin/ads', payload);
        toast.success('Ad created');
      }

      setModalOpen(false);
      await fetchAds();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (ad: SponsorAd) => {
    const prevActive = Boolean(ad.isActive);
    const nextActive = !prevActive;

    // Optimistic flip
    setRowBusy(prev => ({ ...prev, [ad.id]: true }));
    setAds(prev => prev.map(a => (a.id === ad.id ? { ...a, isActive: nextActive } : a)));

    try {
      // PATCH /api/admin/ads/:id/toggle
      // Body supports either empty (server flips) OR explicit desired state.
      const res = await adminApi.patch(`/admin/ads/${ad.id}/toggle`, { isActive: nextActive });
      const updated = res?.data?.ad ?? res?.data;

      if (updated && (updated.id || updated._id)) {
        const next = normalizeAd(updated);
        setAds(prev => prev.map(a => (a.id === ad.id ? { ...a, ...next } : a)));
      }

      toast.success('Updated');
    } catch (err: any) {
      // Revert UI
      setAds(prev => prev.map(a => (a.id === ad.id ? { ...a, isActive: prevActive } : a)));
      toast.error(err?.response?.data?.message || err?.message || 'Toggle failed');
    } finally {
      setRowBusy(prev => ({ ...prev, [ad.id]: false }));
    }
  };

  const removeAd = async (ad: SponsorAd) => {
    if (!confirm(`Delete ad "${ad.title || ad.slot}"?`)) return;

    setRowBusy(prev => ({ ...prev, [ad.id]: true }));
    try {
      // DELETE /api/admin/ads/:id
      await adminApi.delete(`/admin/ads/${ad.id}`);
      setAds(prev => prev.filter(a => a.id !== ad.id));
      toast.success('Ad deleted');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Delete failed');
    } finally {
      setRowBusy(prev => ({ ...prev, [ad.id]: false }));
    }
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Ads Manager</h1>
        <div className="flex flex-wrap gap-2 items-center">
          <button
            onClick={() => void fetchAds()}
            className="px-3 py-1 bg-slate-700 text-white rounded"
            disabled={loading}
          >
            Refresh
          </button>
          <button
            onClick={openCreate}
            className="px-3 py-1 bg-green-600 text-white rounded"
          >
            Create Ad
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 bg-slate-50 dark:bg-slate-800 border rounded p-3">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Slot</label>
          <select
            className="border rounded px-2 py-1 text-sm bg-white dark:bg-slate-900"
            value={slotFilter}
            onChange={(e) => setSlotFilter(e.target.value as any)}
          >
            <option value="ALL">All</option>
            {SLOT_OPTIONS.map(s => (
              <option key={s} value={s}>{slotLabel(String(s))}</option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
          />
          Active only
        </label>

        <div className="text-xs text-slate-500">
          Showing <span className="font-medium">{filteredAds.length}</span>
        </div>
      </div>

      {/* Ad Placements */}
      <div className="border rounded p-4 bg-white dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Ad Placements</h2>
          <button
            type="button"
            onClick={() => void loadSettings()}
            className="px-3 py-1 rounded border text-sm"
            disabled={settingsLoading}
          >
            {settingsLoading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="border rounded p-3 bg-slate-50 dark:bg-slate-950 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Home Banner 728×90</div>
              <div className="text-xs text-slate-500 font-mono">HOME_728x90</div>
            </div>
            <button
              type="button"
              disabled={settingsLoading || placementSaving.HOME_728x90}
              onClick={() => void togglePlacement('HOME_728x90')}
              className={`px-3 py-1 rounded text-xs border min-w-[84px] ${placementSaving.HOME_728x90 ? 'cursor-not-allowed opacity-80' : ''} ${slotEnabled.HOME_728x90 ? 'bg-green-600 text-white border-green-600' : 'bg-slate-200 text-slate-700 border-slate-300'}`}
              title="Toggle placement"
            >
              {placementSaving.HOME_728x90 ? 'Saving…' : (slotEnabled.HOME_728x90 ? 'ON' : 'OFF')}
            </button>
          </div>

          <div className="border rounded p-3 bg-slate-50 dark:bg-slate-950 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Home Right Rail 300×250</div>
              <div className="text-xs text-slate-500 font-mono">HOME_RIGHT_300x250</div>
            </div>
            <button
              type="button"
              disabled={settingsLoading || placementSaving.HOME_RIGHT_300x250}
              onClick={() => void togglePlacement('HOME_RIGHT_300x250')}
              className={`px-3 py-1 rounded text-xs border min-w-[84px] ${placementSaving.HOME_RIGHT_300x250 ? 'cursor-not-allowed opacity-80' : ''} ${slotEnabled.HOME_RIGHT_300x250 ? 'bg-green-600 text-white border-green-600' : 'bg-slate-200 text-slate-700 border-slate-300'}`}
              title="Toggle placement"
            >
              {placementSaving.HOME_RIGHT_300x250 ? 'Saving…' : (slotEnabled.HOME_RIGHT_300x250 ? 'ON' : 'OFF')}
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-auto border rounded">
        <table className="min-w-[980px] w-full text-sm">
          <thead className="bg-slate-100 dark:bg-slate-900">
            <tr>
              <th className="text-left p-2">Slot</th>
              <th className="text-left p-2">Title</th>
              <th className="text-left p-2">Active</th>
              <th className="text-left p-2">Schedule</th>
              <th className="text-left p-2">Priority</th>
              <th className="text-left p-2">Updated</th>
              <th className="text-left p-2">Preview</th>
              <th className="text-left p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="p-3 text-slate-500" colSpan={8}>Loading…</td>
              </tr>
            ) : filteredAds.length === 0 ? (
              <tr>
                <td className="p-3 text-slate-500" colSpan={8}>No ads found.</td>
              </tr>
            ) : (
              filteredAds.map(ad => {
                const busy = Boolean(rowBusy[ad.id]);
                const updatedLabel = safeDateLabel(ad.updatedAt || ad.createdAt);
                const scheduleLabel = `${safeDateLabel(ad.startAt)} → ${safeDateLabel(ad.endAt)}`;

                return (
                  <tr key={ad.id} className="border-t">
                    <td className="p-2 font-mono text-xs">{ad.slot}</td>
                    <td className="p-2">{ad.title || '-'}</td>
                    <td className="p-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void toggleActive(ad)}
                        className={`px-2 py-1 rounded text-xs border min-w-[44px] ${ad.isActive ? 'bg-green-600 text-white border-green-600' : 'bg-slate-200 text-slate-700 border-slate-300'}`}
                        title="Toggle active"
                      >
                        {busy ? '...' : (ad.isActive ? 'ON' : 'OFF')}
                      </button>
                    </td>
                    <td className="p-2 text-xs text-slate-600 dark:text-slate-300">{scheduleLabel}</td>
                    <td className="p-2">{Number(ad.priority ?? 0)}</td>
                    <td className="p-2 text-xs text-slate-600 dark:text-slate-300">{updatedLabel}</td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <div className="w-[120px] h-[40px] bg-slate-100 dark:bg-slate-900 border rounded overflow-hidden flex items-center justify-center">
                          {ad.imageUrl ? (
                            // eslint-disable-next-line @typescript-eslint/no-misused-promises
                            <img src={ad.imageUrl} alt={ad.title || ad.slot} className="max-w-full max-h-full object-contain" />
                          ) : (
                            <span className="text-xs text-slate-400">No image</span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500">Click target</span>
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(ad)}
                          className="px-2 py-1 rounded border text-xs"
                          disabled={busy}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeAd(ad)}
                          className="px-2 py-1 rounded border text-xs text-red-700 border-red-300 hover:bg-red-50"
                          disabled={busy}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded border shadow">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">{editingId ? 'Edit Ad' : 'Create Ad'}</h2>
              <button
                type="button"
                onClick={closeModal}
                className="px-2 py-1 rounded border"
                disabled={saving}
              >
                Close
              </button>
            </div>

            <form onSubmit={submit} className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Slot *</label>
                  <select
                    className="w-full border rounded px-2 py-2 bg-white dark:bg-slate-950"
                    value={form.slot}
                    onChange={(e) => setForm(prev => ({ ...prev, slot: e.target.value as any }))}
                    required
                  >
                    <option value="">Select slot…</option>
                    {SLOT_OPTIONS.map(s => (
                      <option key={s} value={s}>{slotLabel(String(s))}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Title</label>
                  <input
                    className="w-full border rounded px-2 py-2"
                    value={form.title}
                    onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g. Sponsor: ACME"
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="text-sm font-medium">Image URL *</label>
                  <input
                    className="w-full border rounded px-2 py-2"
                    value={form.imageUrl}
                    onChange={(e) => setForm(prev => ({ ...prev, imageUrl: e.target.value }))}
                    placeholder="https://..."
                    required
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="text-sm font-medium">Target URL{form.clickable ? ' *' : ''}</label>
                  <input
                    className="w-full border rounded px-2 py-2"
                    value={form.targetUrl}
                    onChange={(e) => setForm(prev => ({ ...prev, targetUrl: e.target.value }))}
                    placeholder="https://..."
                    required={form.clickable}
                    disabled={!form.clickable}
                  />
                  {!form.clickable && (
                    <div className="text-xs text-slate-500">View-only ad. Users won't be redirected.</div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Priority</label>
                  <input
                    type="number"
                    className="w-full border rounded px-2 py-2"
                    value={form.priority}
                    onChange={(e) => setForm(prev => ({ ...prev, priority: e.target.value }))}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Active</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setForm(prev => ({ ...prev, isActive: e.target.checked }))}
                    />
                    <span className="text-sm">Is Active</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Clickable Ad</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.clickable}
                      onChange={(e) => {
                        const next = e.target.checked;
                        setForm(prev => ({
                          ...prev,
                          clickable: next,
                          targetUrl: next ? prev.targetUrl : '',
                        }));
                      }}
                    />
                    <span className="text-sm">Clickable</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Start At</label>
                  <input
                    type="datetime-local"
                    className="w-full border rounded px-2 py-2"
                    value={form.startAt}
                    onChange={(e) => setForm(prev => ({ ...prev, startAt: e.target.value }))}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">End At</label>
                  <input
                    type="datetime-local"
                    className="w-full border rounded px-2 py-2"
                    value={form.endAt}
                    onChange={(e) => setForm(prev => ({ ...prev, endAt: e.target.value }))}
                  />
                </div>
              </div>

              {/* Preview */}
              <div className="border rounded p-3 bg-slate-50 dark:bg-slate-950">
                <div className="text-sm font-medium mb-2">Preview</div>
                <div className="flex items-center gap-3">
                  <div className="w-[240px] h-[80px] bg-white dark:bg-slate-900 border rounded overflow-hidden flex items-center justify-center">
                    {form.imageUrl.trim() ? (
                      // eslint-disable-next-line @typescript-eslint/no-misused-promises
                      <img src={form.imageUrl.trim()} alt="Ad preview" className="max-w-full max-h-full object-contain" />
                    ) : (
                      <span className="text-xs text-slate-400">Image preview</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    <div className="font-medium">Click target</div>
                    <div className="break-all">{(!form.clickable || !form.targetUrl.trim()) ? '(none)' : form.targetUrl.trim()}</div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-3 py-2 rounded border"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-2 rounded bg-blue-600 text-white"
                  disabled={saving}
                >
                  {saving ? 'Saving…' : (editingId ? 'Save Changes' : 'Create Ad')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
