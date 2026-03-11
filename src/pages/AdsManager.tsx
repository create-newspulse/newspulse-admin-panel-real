import React from 'react';
import toast from 'react-hot-toast';

import { adminApi } from '@/lib/api';
import {
  type AdInquiry,
  type AdInquiryListResult,
  type AdInquiryStatus,
  ADS_INQUIRIES_BASE,
  getAdInquiryStatusCount,
  logAdsInquiriesDiagnostic,
  getAdInquiriesUnreadCount,
  listAdInquiries,
  markAdInquiryRead,
  markAdInquiriesRead,
  moveAdInquiryToTrash,
  moveAdInquiriesToTrash,
  permanentlyDeleteAdInquiries,
  permanentlyDeleteAdInquiry,
  restoreAdInquiry,
  restoreAdInquiries,
  messagePreview,
} from '@/lib/adsInquiriesApi';

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

type InquiryApiErrorState = {
  kind: 'offline' | 'db-unavailable' | 'request';
  message: string;
  status?: number;
  url?: string;
  code?: string;
};

function isAbortError(err: any): boolean {
  const name = String(err?.name || '');
  const message = String(err?.message || '');
  return name === 'AbortError' || /aborted/i.test(message);
}

function describeInquiryError(err: any, fallback: string): InquiryApiErrorState {
  const status = typeof err?.status === 'number'
    ? err.status
    : (typeof err?.response?.status === 'number' ? err.response.status : undefined);
  const code = String(err?.code || err?.response?.data?.code || '').trim().toUpperCase() || undefined;
  const url = typeof err?.url === 'string'
    ? err.url
    : (typeof err?.response?.config?.url === 'string' ? err.response.config.url : undefined);

  if (code === 'BACKEND_OFFLINE' || status === 0) {
    return {
      kind: 'offline',
      status,
      url,
      code,
      message: 'Backend unreachable. Start local backend on http://localhost:5000 or update VITE_ADMIN_API_TARGET / VITE_DEV_PROXY_TARGET, then restart npm run dev.',
    };
  }

  if (code === 'DB_UNAVAILABLE' || status === 503) {
    return {
      kind: 'db-unavailable',
      status,
      url,
      code,
      message: 'Database unavailable. Wait for the backend database connection to recover.',
    };
  }

  return {
    kind: 'request',
    status,
    url,
    code,
    message: String(err?.message || fallback),
  };
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
  const [tab, setTab] = React.useState<'ads' | 'inquiries'>('ads');

  type InquiryStatusTab = 'new' | 'read' | 'deleted';
  type InquiryTabCounts = Record<InquiryStatusTab, number | null>;
  const [inquiryStatusTab, setInquiryStatusTab] = React.useState<InquiryStatusTab>('new');
  const [inquiryPage, setInquiryPage] = React.useState(1);
  const inquiryLimit = 20;
  const [inquirySearchInput, setInquirySearchInput] = React.useState('');
  const [inquirySearch, setInquirySearch] = React.useState('');

  const [ads, setAds] = React.useState<SponsorAd[]>([]);
  const [loading, setLoading] = React.useState(false);

  const [inquiries, setInquiries] = React.useState<AdInquiry[]>([]);
  const [, setInquiriesTotal] = React.useState<number | null>(null);
  const [inquiryTabCounts, setInquiryTabCounts] = React.useState<InquiryTabCounts>({ new: null, read: null, deleted: null });
  const [inquiriesLoading, setInquiriesLoading] = React.useState(false);
  const [, setInquiriesUnreadCount] = React.useState<number | null>(null);
  const [inquiriesUnreadError, setInquiriesUnreadError] = React.useState<InquiryApiErrorState | null>(null);
  const [inquiriesError, setInquiriesError] = React.useState<InquiryApiErrorState | null>(null);
  const [inquiryBusy, setInquiryBusy] = React.useState<Record<string, boolean>>({});
  const [selectedInquiryIds, setSelectedInquiryIds] = React.useState<string[]>([]);
  const [bulkAction, setBulkAction] = React.useState<'mark-read' | 'move-to-trash' | 'restore' | 'delete-permanently' | null>(null);
  const [confirmBulkPermanentDelete, setConfirmBulkPermanentDelete] = React.useState(false);
  const lastUnreadRef = React.useRef<number | null>(null);
  const selectAllVisibleRef = React.useRef<HTMLInputElement | null>(null);

  const [inquiryView, setInquiryView] = React.useState<AdInquiry | null>(null);

  const hasNextInquiryPage = inquiries.length === inquiryLimit;
  const hasPrevInquiryPage = inquiryPage > 1;

  const tabLabelMap: Record<InquiryStatusTab, string> = React.useMemo(() => ({
    new: 'new',
    read: 'read',
    deleted: 'deleted',
  }), []);
  const activeSubtitle = React.useMemo(() => {
    return `Showing ${tabLabelMap[inquiryStatusTab]} inquiries`;
  }, [inquiryStatusTab, tabLabelMap]);
  const activeCornerCountLabel = React.useMemo(() => {
    const value = inquiryTabCounts[inquiryStatusTab];
    return typeof value === 'number' ? String(value) : '—';
  }, [inquiryStatusTab, inquiryTabCounts]);
  const activeCornerTitle = React.useMemo(() => {
    if (inquiryStatusTab === 'new') return 'New inquiries';
    if (inquiryStatusTab === 'read') return 'Read inquiries';
    return 'Deleted inquiries';
  }, [inquiryStatusTab]);

  const emptyInquiriesText = React.useMemo(() => {
    const base = `No ${tabLabelMap[inquiryStatusTab]} inquiries`;
    if (inquirySearch) {
      return `${base} match "${inquirySearch}".`;
    }
    if (inquiryPage > 1) {
      return `${base} on page ${inquiryPage}.`;
    }
    return `${base}.`;
  }, [inquiryPage, inquirySearch, inquiryStatusTab, tabLabelMap]);

  const canEmailFromCurrentTab = inquiryStatusTab !== 'deleted';
  const visibleInquiryIds = React.useMemo(
    () => inquiries.map((inq) => String(inq.id || '').trim()).filter(Boolean),
    [inquiries]
  );
  const selectedVisibleInquiryIds = React.useMemo(
    () => selectedInquiryIds.filter((id) => visibleInquiryIds.includes(id)),
    [selectedInquiryIds, visibleInquiryIds]
  );
  const selectedCount = selectedVisibleInquiryIds.length;
  const allVisibleSelected = visibleInquiryIds.length > 0 && selectedVisibleInquiryIds.length === visibleInquiryIds.length;
  const hasSomeVisibleSelected = selectedVisibleInquiryIds.length > 0 && !allVisibleSelected;
  const bulkBusy = bulkAction !== null;

  const mailtoHref = React.useCallback((email?: string | null) => {
    const value = String(email || '').trim();
    return value ? `mailto:${value}` : '';
  }, []);

  const clearInquirySelection = React.useCallback(() => {
    setSelectedInquiryIds([]);
  }, []);

  const toggleInquirySelection = React.useCallback((id: string) => {
    const safeId = String(id || '').trim();
    if (!safeId) return;
    setSelectedInquiryIds((prev) => (
      prev.includes(safeId)
        ? prev.filter((value) => value !== safeId)
        : [...prev, safeId]
    ));
  }, []);

  const toggleSelectAllVisible = React.useCallback(() => {
    if (!visibleInquiryIds.length) return;
    setSelectedInquiryIds((prev) => {
      if (visibleInquiryIds.every((id) => prev.includes(id))) {
        return prev.filter((id) => !visibleInquiryIds.includes(id));
      }
      const next = new Set(prev);
      for (const id of visibleInquiryIds) next.add(id);
      return Array.from(next);
    });
  }, [visibleInquiryIds]);

  const adjustInquiryPageAfterBulk = React.useCallback((removedCount: number) => {
    const nextVisibleCount = inquiries.length - removedCount;
    if (inquiryPage > 1 && nextVisibleCount <= 0) {
      setInquiryPage((prev) => Math.max(1, prev - 1));
      return true;
    }
    return false;
  }, [inquiries.length, inquiryPage]);

  const refreshInquiryTabCounts = React.useCallback(async () => {
    try {
      const [newCount, readCount, deletedCount] = await Promise.all([
        getAdInquiryStatusCount('new' as AdInquiryStatus),
        getAdInquiryStatusCount('read' as AdInquiryStatus),
        getAdInquiryStatusCount('deleted' as AdInquiryStatus),
      ]);
      setInquiryTabCounts({ new: newCount, read: readCount, deleted: deletedCount });
    } catch (err: any) {
      if (isAbortError(err)) return;
      if (import.meta.env.DEV) {
        logAdsInquiriesDiagnostic('counts:failed', {
          message: err?.message || 'Failed to load inquiry tab counts',
          status: err?.status,
          code: err?.code,
        });
      }
    }
  }, []);

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

  const fetchInquiries = React.useCallback(async (opts: {
    status: InquiryStatusTab;
    page: number;
    limit: number;
    search: string;
    signal?: AbortSignal;
  }) => {
    setInquiriesLoading(true);
    try {
      const list = await listAdInquiries({
        status: opts.status,
        page: opts.page,
        limit: opts.limit,
        search: opts.search,
        signal: opts.signal,
      });
      const result = list as AdInquiryListResult;
      setInquiries(result.items);
      setInquiriesTotal(typeof result.total === 'number' ? result.total : result.items.length);
      setInquiryTabCounts((prev) => ({
        ...prev,
        [opts.status]: typeof result.total === 'number' ? result.total : result.items.length,
      }));
      setInquiriesError(null);
      if (import.meta.env.DEV) {
        logAdsInquiriesDiagnostic('list:render-ready', {
          url: `${ADS_INQUIRIES_BASE}?status=${opts.status}&page=${opts.page}&limit=${opts.limit}&search=${encodeURIComponent(opts.search)}`,
          message: `Rendering ${result.items.length} rows (tab total: ${typeof result.total === 'number' ? result.total : result.items.length})`,
          source: result.source,
          raw: result.raw,
        });
      }
    } catch (err: any) {
      if (isAbortError(err)) return;

      const nextError = describeInquiryError(err, 'Failed to load inquiries');
      setInquiries([]);
      setInquiriesTotal(null);
      setInquiriesUnreadCount(null);
      setInquiriesUnreadError(nextError);
      setInquiriesError(nextError);
      lastUnreadRef.current = null;
      logAdsInquiriesDiagnostic('list:failed', {
        url: nextError.url || `${ADS_INQUIRIES_BASE}?status=${opts.status}&page=${opts.page}&limit=${opts.limit}&search=${encodeURIComponent(opts.search)}`,
        status: nextError.status,
        message: nextError.message,
        code: nextError.code,
      });
      toast.error(nextError.message);
    } finally {
      setInquiriesLoading(false);
    }
  }, []);

  const fetchUnreadCount = React.useCallback(async () => {
    try {
      const next = await getAdInquiriesUnreadCount();
      setInquiriesUnreadCount(next);
      setInquiryTabCounts((prev) => ({ ...prev, new: next }));
      setInquiriesUnreadError(null);

      const prev = lastUnreadRef.current;
      if (typeof prev === 'number' && next > prev) {
        toast('New Ad Inquiry received');
      }
      lastUnreadRef.current = next;
    } catch (err: any) {
      if (isAbortError(err)) return;

      const nextError = describeInquiryError(err, 'Unread count unavailable');
      // Polling should not spam errors, but the UI should not lie.
      setInquiriesUnreadCount(null);
      setInquiryTabCounts((prev) => ({ ...prev, new: null }));
      setInquiriesUnreadError(nextError);
      lastUnreadRef.current = null;
      logAdsInquiriesDiagnostic('unread-count:failed', {
        url: nextError.url || `${ADS_INQUIRIES_BASE}/unread-count`,
        status: nextError.status,
        message: nextError.message,
        code: nextError.code,
      });
    }
  }, []);

  const refreshInquiryDataAfterBulk = React.useCallback(async (removedCount: number) => {
    const movedToPreviousPage = adjustInquiryPageAfterBulk(removedCount);
    if (!movedToPreviousPage) {
      await fetchInquiries({
        status: inquiryStatusTab,
        page: inquiryPage,
        limit: inquiryLimit,
        search: inquirySearch,
      });
    }
    await Promise.all([fetchUnreadCount(), refreshInquiryTabCounts()]);
  }, [adjustInquiryPageAfterBulk, fetchInquiries, fetchUnreadCount, inquiryLimit, inquiryPage, inquirySearch, inquiryStatusTab, refreshInquiryTabCounts]);

  const applyBulkInquiryAction = React.useCallback(async (action: 'mark-read' | 'move-to-trash' | 'restore' | 'delete-permanently', ids: string[]) => {
    const safeIds = ids.map((id) => String(id || '').trim()).filter(Boolean);
    if (!safeIds.length) return;

    setBulkAction(action);
    try {
      if (action === 'delete-permanently') {
        await permanentlyDeleteAdInquiries(safeIds);
      }
      if (action === 'restore') {
        await restoreAdInquiries(safeIds);
      }
      if (action === 'move-to-trash') {
        await moveAdInquiriesToTrash(safeIds);
      }
      if (action === 'mark-read') {
        await markAdInquiriesRead(safeIds);
      }

      clearInquirySelection();
      await refreshInquiryDataAfterBulk(safeIds.length);

      const countLabel = `${safeIds.length} ${safeIds.length === 1 ? 'inquiry' : 'inquiries'}`;
      if (action === 'restore') toast.success(`${countLabel} restored`);
      if (action === 'delete-permanently') toast.success(`${countLabel} deleted permanently`);
      if (action === 'move-to-trash') toast.success(`${countLabel} moved to trash`);
      if (action === 'mark-read') toast.success(`${countLabel} marked as read`);
    } catch (err: any) {
      const fallback = action === 'restore'
        ? 'Failed to restore selected inquiries'
        : action === 'delete-permanently'
          ? 'Failed to permanently delete selected inquiries'
          : action === 'move-to-trash'
            ? 'Failed to move selected inquiries to trash'
            : 'Failed to mark selected inquiries as read';
      toast.error(err?.message || fallback);
    } finally {
      setBulkAction(null);
    }
  }, [clearInquirySelection, refreshInquiryDataAfterBulk]);

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

  React.useEffect(() => {
    void fetchUnreadCount();
    const id = window.setInterval(() => {
      void fetchUnreadCount();
    }, 30_000);
    return () => window.clearInterval(id);
  }, [fetchUnreadCount]);

  React.useEffect(() => {
    if (tab !== 'inquiries') return;
    // Reset when switching into inquiries.
    setInquiryStatusTab('new');
    setInquiryPage(1);
    setInquirySearchInput('');
    setInquirySearch('');
    clearInquirySelection();
  }, [tab]);

  // Debounce search input -> server query.
  React.useEffect(() => {
    if (tab !== 'inquiries') return;
    const id = window.setTimeout(() => {
      setInquirySearch(inquirySearchInput.trim());
      setInquiryPage(1);
    }, 350);
    return () => window.clearTimeout(id);
  }, [tab, inquirySearchInput]);

  React.useEffect(() => {
    if (tab !== 'inquiries') return;
    const ac = new AbortController();
    void fetchInquiries({
      status: inquiryStatusTab,
      page: inquiryPage,
      limit: inquiryLimit,
      search: inquirySearch,
      signal: ac.signal,
    });
    return () => ac.abort();
  }, [tab, fetchInquiries, inquiryStatusTab, inquiryPage, inquiryLimit, inquirySearch]);

  React.useEffect(() => {
    setSelectedInquiryIds((prev) => prev.filter((id) => visibleInquiryIds.includes(id)));
  }, [visibleInquiryIds]);

  React.useEffect(() => {
    if (!selectAllVisibleRef.current) return;
    selectAllVisibleRef.current.indeterminate = hasSomeVisibleSelected;
  }, [hasSomeVisibleSelected]);

  React.useEffect(() => {
    if (tab !== 'inquiries') return;
    void refreshInquiryTabCounts();
  }, [tab, refreshInquiryTabCounts]);

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
          {tab === 'ads' ? (
            <>
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
            </>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setTab('ads')}
          className={
            'px-3 py-1.5 rounded border text-sm font-semibold ' +
            (tab === 'ads' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-900 border-slate-200')
          }
        >
          Ads
        </button>
        <button
          type="button"
          onClick={() => setTab('inquiries')}
          className={
            'px-3 py-1.5 rounded border text-sm font-semibold ' +
            (tab === 'inquiries' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-900 border-slate-200')
          }
        >
          Ad Inquiries
        </button>
      </div>

      {tab === 'inquiries' ? (
        <div className="space-y-4">
          <div className="border rounded p-4 bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Ad Inquiries</h2>
                <div className="text-sm text-slate-600 dark:text-slate-300">
                  {activeSubtitle}
                </div>
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-300">
                {activeCornerTitle}:{' '}
                <span className="font-semibold text-slate-900 dark:text-white">
                  {activeCornerCountLabel}
                </span>
                {inquiriesUnreadError ? (
                  <span className="ml-2 text-xs text-slate-500" title={inquiriesUnreadError.message}>API error</span>
                ) : null}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => { clearInquirySelection(); setInquiryStatusTab('new'); setInquiryPage(1); }}
                  className={
                    'px-3 py-1.5 rounded border text-sm font-semibold ' +
                    (inquiryStatusTab === 'new' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-900 border-slate-200')
                  }
                  disabled={bulkBusy}
                >
                  New
                </button>
                <button
                  type="button"
                  onClick={() => { clearInquirySelection(); setInquiryStatusTab('read'); setInquiryPage(1); }}
                  className={
                    'px-3 py-1.5 rounded border text-sm font-semibold ' +
                    (inquiryStatusTab === 'read' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-900 border-slate-200')
                  }
                  disabled={bulkBusy}
                >
                  Read
                </button>
                <button
                  type="button"
                  onClick={() => { clearInquirySelection(); setInquiryStatusTab('deleted'); setInquiryPage(1); }}
                  className={
                    'px-3 py-1.5 rounded border text-sm font-semibold ' +
                    (inquiryStatusTab === 'deleted' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-900 border-slate-200')
                  }
                  disabled={bulkBusy}
                >
                  Deleted
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={inquirySearchInput}
                  onChange={(e) => setInquirySearchInput(e.target.value)}
                  placeholder="Search…"
                  className="border rounded px-3 py-1.5 text-sm bg-white dark:bg-slate-950"
                  disabled={bulkBusy}
                />
                {inquirySearchInput ? (
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded border text-sm"
                    onClick={() => { clearInquirySelection(); setInquirySearchInput(''); }}
                    disabled={bulkBusy}
                  >
                    Clear
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {selectedCount > 0 ? (
            <div className="border rounded p-3 bg-slate-50 dark:bg-slate-900/60 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                {selectedCount} selected
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {inquiryStatusTab === 'new' ? (
                  <>
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded border text-sm"
                      disabled={bulkBusy}
                      onClick={() => void applyBulkInquiryAction('mark-read', selectedVisibleInquiryIds)}
                    >
                      {bulkAction === 'mark-read' ? 'Working…' : 'Mark Selected Read'}
                    </button>
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded border text-sm text-red-700 border-red-300 hover:bg-red-50"
                      disabled={bulkBusy}
                      onClick={() => void applyBulkInquiryAction('move-to-trash', selectedVisibleInquiryIds)}
                    >
                      {bulkAction === 'move-to-trash' ? 'Working…' : 'Move Selected to Trash'}
                    </button>
                  </>
                ) : null}

                {inquiryStatusTab === 'read' ? (
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded border text-sm text-red-700 border-red-300 hover:bg-red-50"
                    disabled={bulkBusy}
                    onClick={() => void applyBulkInquiryAction('move-to-trash', selectedVisibleInquiryIds)}
                  >
                    {bulkAction === 'move-to-trash' ? 'Working…' : 'Move Selected to Trash'}
                  </button>
                ) : null}

                {inquiryStatusTab === 'deleted' ? (
                  <>
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded border text-sm"
                      disabled={bulkBusy}
                      onClick={() => void applyBulkInquiryAction('restore', selectedVisibleInquiryIds)}
                    >
                      {bulkAction === 'restore' ? 'Working…' : 'Restore Selected'}
                    </button>
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded border text-sm text-red-700 border-red-300 hover:bg-red-50"
                      disabled={bulkBusy}
                      onClick={() => setConfirmBulkPermanentDelete(true)}
                    >
                      Delete Selected Permanently
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}

          {inquiriesError ? (
            <div className="border rounded p-3 bg-rose-50 text-rose-900 border-rose-200">
              <div className="text-sm font-semibold">
                {inquiriesError.kind === 'offline'
                  ? 'Backend unreachable'
                  : (inquiriesError.kind === 'db-unavailable' ? 'Database unavailable' : 'Failed to load inquiries')}
              </div>
              <div className="text-xs mt-1">
                {inquiriesError.status ? `HTTP ${inquiriesError.status}: ` : ''}{inquiriesError.message}
                {inquiriesError.url ? ` • ${inquiriesError.url}` : ''}
              </div>
            </div>
          ) : null}

          <div className="overflow-auto border rounded">
            <table className="min-w-[980px] w-full text-sm">
              <thead className="bg-slate-100 dark:bg-slate-900">
                <tr>
                  <th className="text-left p-2 w-10">
                    <input
                      ref={selectAllVisibleRef}
                      type="checkbox"
                      checked={allVisibleSelected}
                      disabled={bulkBusy || visibleInquiryIds.length === 0}
                      onChange={() => toggleSelectAllVisible()}
                      aria-label="Select all visible inquiries"
                    />
                  </th>
                  <th className="text-left p-2">Name</th>
                  <th className="text-left p-2">Email</th>
                  <th className="text-left p-2">Message</th>
                  <th className="text-left p-2">Created</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {inquiriesLoading ? (
                  <tr>
                    <td className="p-3 text-slate-500" colSpan={7}>Loading…</td>
                  </tr>
                ) : inquiriesError ? (
                  <tr>
                    <td className="p-3 text-rose-700" colSpan={7}>
                      {inquiriesError.kind === 'offline'
                        ? 'Backend unreachable. '
                        : (inquiriesError.kind === 'db-unavailable' ? 'Database unavailable. ' : '')}
                      {inquiriesError.status ? `HTTP ${inquiriesError.status}: ` : ''}{inquiriesError.message}
                    </td>
                  </tr>
                ) : inquiries.length === 0 ? (
                  <tr>
                    <td className="p-3 text-slate-500" colSpan={7}>
                      {emptyInquiriesText}
                    </td>
                  </tr>
                ) : (
                  inquiries.map((inq) => {
                    const busy = !!inquiryBusy[inq.id];
                    const statusLower = String(inq.status || '').toLowerCase();
                    const isDeleted = statusLower === 'deleted';
                    const isRead = statusLower === 'read';
                    const canRestore = isDeleted || inquiryStatusTab === 'deleted';
                    return (
                      <tr key={inq.id} className="border-t">
                        <td className="p-2 align-top">
                          <input
                            type="checkbox"
                            checked={selectedInquiryIds.includes(inq.id)}
                            disabled={bulkBusy}
                            onChange={() => toggleInquirySelection(inq.id)}
                            aria-label={`Select inquiry ${inq.name || inq.id}`}
                          />
                        </td>
                        <td className="p-2">{inq.name || '-'}</td>
                        <td className="p-2">
                          {inq.email ? (
                            canEmailFromCurrentTab ? (
                              <a
                                className="text-blue-600 hover:underline"
                                href={mailtoHref(inq.email)}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {inq.email}
                              </a>
                            ) : (
                              <span>{inq.email}</span>
                            )
                          ) : '-'}
                        </td>
                        <td className="p-2" title={inq.message || ''}>{messagePreview(inq.message || '') || '-'}</td>
                        <td className="p-2 text-xs text-slate-600 dark:text-slate-300">{safeDateLabel(inq.createdAt)}</td>
                        <td className="p-2">{inq.status || 'new'}</td>
                        <td className="p-2">
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="px-2 py-1 rounded border text-xs"
                                disabled={busy || bulkBusy}
                                onClick={() => setInquiryView(inq)}
                              >
                                View
                              </button>

                              {inquiryStatusTab === 'new' ? (
                                <button
                                  type="button"
                                  className="px-2 py-1 rounded border text-xs"
                                  disabled={busy || bulkBusy || isRead || isDeleted}
                                  onClick={async () => {
                                    setInquiryBusy((m) => ({ ...m, [inq.id]: true }));
                                    try {
                                      await markAdInquiryRead(inq.id);
                                      setSelectedInquiryIds((prev) => prev.filter((id) => id !== inq.id));
                                      await refreshInquiryDataAfterBulk(1);
                                    } catch (err: any) {
                                      toast.error(err?.message || 'Failed to mark read');
                                    } finally {
                                      setInquiryBusy((m) => ({ ...m, [inq.id]: false }));
                                    }
                                  }}
                                >
                                  {busy ? 'Working…' : 'Mark Read'}
                                </button>
                              ) : null}

                              {inquiryStatusTab !== 'deleted' ? (
                                inq.email ? (
                                  <a
                                    className="px-2 py-1 rounded border text-xs"
                                    href={mailtoHref(inq.email)}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    Email
                                  </a>
                                ) : (
                                  <button type="button" className="px-2 py-1 rounded border text-xs" disabled>
                                    Email
                                  </button>
                                )
                              ) : null}

                              {canRestore ? (
                                <button
                                  type="button"
                                  className="px-2 py-1 rounded border text-xs"
                                  disabled={busy || bulkBusy || !canRestore}
                                  onClick={async () => {
                                    setInquiryBusy((m) => ({ ...m, [inq.id]: true }));
                                    try {
                                      await restoreAdInquiry(inq.id);
                                      setSelectedInquiryIds((prev) => prev.filter((id) => id !== inq.id));
                                      await refreshInquiryDataAfterBulk(1);
                                    } catch (err: any) {
                                      toast.error(err?.message || 'Failed to restore inquiry');
                                    } finally {
                                      setInquiryBusy((m) => ({ ...m, [inq.id]: false }));
                                    }
                                  }}
                                >
                                  {busy ? 'Working…' : 'Restore'}
                                </button>
                              ) : null}
                            </div>

                            <div className="flex flex-wrap gap-2 border-l border-slate-200 dark:border-slate-700 pl-3">
                              {inquiryStatusTab !== 'deleted' ? (
                                <button
                                  type="button"
                                  className="px-2 py-1 rounded border text-xs text-red-700 border-red-300 hover:bg-red-50"
                                  disabled={busy || bulkBusy || isDeleted}
                                  onClick={async () => {
                                    setInquiryBusy((m) => ({ ...m, [inq.id]: true }));
                                    try {
                                      await moveAdInquiryToTrash(inq.id);
                                      setSelectedInquiryIds((prev) => prev.filter((id) => id !== inq.id));
                                      await refreshInquiryDataAfterBulk(1);
                                    } catch (err: any) {
                                      toast.error(err?.message || 'Failed to move inquiry to trash');
                                    } finally {
                                      setInquiryBusy((m) => ({ ...m, [inq.id]: false }));
                                    }
                                  }}
                                >
                                  {busy ? 'Working…' : 'Move to Trash'}
                                </button>
                              ) : null}

                              {inquiryStatusTab === 'deleted' ? (
                                <button
                                  type="button"
                                  className="px-2 py-1 rounded border text-xs text-red-700 border-red-300 hover:bg-red-50"
                                  disabled={busy || bulkBusy}
                                  onClick={async () => {
                                    const ok = window.confirm('Permanently delete this inquiry? This cannot be undone.');
                                    if (!ok) return;
                                    setInquiryBusy((m) => ({ ...m, [inq.id]: true }));
                                    try {
                                      await permanentlyDeleteAdInquiry(inq.id);
                                      setSelectedInquiryIds((prev) => prev.filter((id) => id !== inq.id));
                                      await refreshInquiryDataAfterBulk(1);
                                      toast.success('Inquiry permanently deleted');
                                    } catch (err: any) {
                                      toast.error(err?.message || 'Failed to permanently delete inquiry');
                                    } finally {
                                      setInquiryBusy((m) => ({ ...m, [inq.id]: false }));
                                    }
                                  }}
                                >
                                  {busy ? 'Working…' : 'Delete Permanently'}
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-3 text-sm">
            <div className="text-slate-600 dark:text-slate-300">
              Page <span className="font-semibold text-slate-900 dark:text-white">{inquiryPage}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="px-3 py-1.5 rounded border"
                disabled={inquiriesLoading || !hasPrevInquiryPage}
                onClick={() => setInquiryPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </button>
              <button
                type="button"
                className="px-3 py-1.5 rounded border"
                disabled={inquiriesLoading || !hasNextInquiryPage}
                onClick={() => setInquiryPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'inquiries' && confirmBulkPermanentDelete ? (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded border shadow">
            <div className="p-4 border-b">
              <h3 className="text-lg font-semibold">Delete selected inquiries permanently?</h3>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                This will remove the selected inquiries forever and cannot be undone.
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded border"
                  disabled={bulkBusy}
                  onClick={() => setConfirmBulkPermanentDelete(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded border bg-red-600 text-white border-red-600 disabled:opacity-60"
                  disabled={bulkBusy}
                  onClick={async () => {
                    setConfirmBulkPermanentDelete(false);
                    await applyBulkInquiryAction('delete-permanently', selectedVisibleInquiryIds);
                  }}
                >
                  {bulkAction === 'delete-permanently' ? 'Deleting…' : 'Delete Permanently'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Inquiry View Modal */}
      {tab === 'inquiries' && inquiryView ? (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded border shadow">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Ad Inquiry</h3>
              <button
                type="button"
                onClick={() => setInquiryView(null)}
                className="px-2 py-1 rounded border"
              >
                Close
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-slate-500">Name</div>
                  <div className="font-medium">{inquiryView.name || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Email</div>
                  {inquiryView.email ? (
                    canEmailFromCurrentTab ? (
                      <a className="font-medium underline text-blue-600" href={mailtoHref(inquiryView.email)}>
                        {inquiryView.email}
                      </a>
                    ) : (
                      <div className="font-medium">{inquiryView.email}</div>
                    )
                  ) : (
                    <div className="font-medium">-</div>
                  )}
                </div>
                <div>
                  <div className="text-xs text-slate-500">Created</div>
                  <div className="font-medium">{safeDateLabel(inquiryView.createdAt)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Status</div>
                  <div className="font-medium">{inquiryView.status || 'new'}</div>
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500">Message</div>
                <div className="mt-1 whitespace-pre-wrap text-sm border rounded p-3 bg-slate-50 dark:bg-slate-950">
                  {inquiryView.message || '-'}
                </div>
              </div>

              <div className="flex items-center justify-end pt-2 border-t">
                {canEmailFromCurrentTab && inquiryView.email ? (
                  <a
                    className="px-3 py-1.5 rounded border text-blue-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                    href={mailtoHref(inquiryView.email)}
                  >
                    Email Advertiser
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'ads' ? (
        <>

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
        </>
      ) : null}
    </div>
  );
}
