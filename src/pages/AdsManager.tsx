import React from 'react';
import toast from 'react-hot-toast';

import { adminApi, api } from '@/lib/api';
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
  replyToAdInquiry,
  restoreAdInquiry,
  restoreAdInquiries,
  messagePreview,
} from '@/lib/adsInquiriesApi';

type AdSlot = 'HOME_728x90' | 'HOME_RIGHT_300x250' | 'HOME_RIGHT_RAIL' | 'ARTICLE_INLINE' | 'ARTICLE_END';

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

// Slots that have placement toggles in the UI.
const PLACEMENT_SLOT_OPTIONS = [
  'HOME_728x90',
  'HOME_RIGHT_300x250',
  'ARTICLE_INLINE',
  'ARTICLE_END',
] as const satisfies readonly AdSlot[];

// Slots selectable in the UI (dropdown + filter). Legacy slots are intentionally hidden.
const SLOT_OPTIONS = [
  'HOME_728x90',
  'HOME_RIGHT_300x250',
  'ARTICLE_INLINE',
  'ARTICLE_END',
] as const satisfies readonly AdSlot[];

type PlacementSlotOption = typeof PLACEMENT_SLOT_OPTIONS[number];

const SLOT_LABELS: Record<string, string> = {
  HOME_728x90: 'Home Banner 728×90',
  HOME_RIGHT_300x250: 'Home Right Rail 300×250',
  ARTICLE_INLINE: 'Article Inline',
  ARTICLE_END: 'Article End',
  HOME_RIGHT_RAIL: 'Home Right Rail (legacy)',
};

function canonicalSlot(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  // Normalize common label formats (e.g. "Article End" -> "ARTICLE_END").
  const normalized = raw
    .toUpperCase()
    .replace(/[\s\-]+/g, '_')
    .replace(/__+/g, '_')
    .trim();
  // Preserve exact backend enum casing (note the lowercase 'x').
  if (normalized === 'HOME_728X90') return 'HOME_728x90';
  if (normalized === 'HOME_RIGHT_300X250') return 'HOME_RIGHT_300x250';
  if (normalized === 'HOME_RIGHT_RAIL') return 'HOME_RIGHT_RAIL';
  if (normalized === 'ARTICLE_INLINE') return 'ARTICLE_INLINE';
  if (normalized === 'ARTICLE_END') return 'ARTICLE_END';

  return raw;
}

function slotLabel(slot: string): string {
  return SLOT_LABELS[slot] || slot;
}

function isLegacySlot(slot: string): boolean {
  return canonicalSlot(slot) === 'HOME_RIGHT_RAIL' || slotLabel(slot).includes('(legacy)');
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

function inquiryReplySubject(inquiry: Pick<AdInquiry, 'name'>): string {
  const name = String(inquiry?.name || '').trim();
  return name ? `Re: NewsPulse ad inquiry from ${name}` : 'Re: NewsPulse ad inquiry';
}

function inquiryReplyDraftMessage(inquiry: Pick<AdInquiry, 'name'>): string {
  const name = String(inquiry?.name || '').trim();
  return `${name ? `Hello ${name},` : 'Hello,'}\n\n`;
}

type InquiryReplyMeta = Pick<AdInquiry, 'hasReply' | 'lastRepliedAt' | 'lastRepliedBy' | 'replyCount' | 'lastReplySubject'>;

function applyReplyMeta(inquiry: AdInquiry, meta?: InquiryReplyMeta): AdInquiry {
  if (!meta) return inquiry;
  return { ...inquiry, ...meta };
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
    slot: canonicalSlot(raw?.slot ?? ''),
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

function extractAdsList(payload: any): any[] {
  if (Array.isArray(payload)) return payload;

  const direct = payload?.ads;
  if (Array.isArray(direct)) return direct;

  const data = payload?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.ads)) return data.ads;
  if (Array.isArray(data?.items)) return data.items;

  const result = payload?.result;
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.ads)) return result.ads;
  if (Array.isArray(result?.items)) return result.items;

  const items = payload?.items;
  if (Array.isArray(items)) return items;

  return [];
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
  const [inquiryReplyOverrides, setInquiryReplyOverrides] = React.useState<Record<string, InquiryReplyMeta>>({});
  const inquiryReplyOverridesRef = React.useRef<Record<string, InquiryReplyMeta>>({});

  const [inquiryView, setInquiryView] = React.useState<AdInquiry | null>(null);
  const [inquiryReply, setInquiryReply] = React.useState<{
    inquiry: AdInquiry;
    subject: string;
    message: string;
  } | null>(null);
  const [inquiryReplySending, setInquiryReplySending] = React.useState(false);

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

  React.useEffect(() => {
    inquiryReplyOverridesRef.current = inquiryReplyOverrides;
  }, [inquiryReplyOverrides]);

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

  const openInquiryReplyComposer = React.useCallback((inquiry: AdInquiry) => {
    setInquiryReply({
      inquiry,
      subject: inquiryReplySubject(inquiry),
      message: inquiryReplyDraftMessage(inquiry),
    });
  }, []);

  const closeInquiryReplyComposer = React.useCallback(() => {
    if (inquiryReplySending) return;
    setInquiryReply(null);
  }, [inquiryReplySending]);

  const closeInquiryView = React.useCallback(() => {
    setInquiryReply(null);
    setInquiryView(null);
  }, []);

  const sendInquiryReply = React.useCallback(async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!inquiryReply || inquiryReplySending) return;

    const subject = inquiryReply.subject.trim();
    const message = inquiryReply.message.trim();

    if (!subject) {
      toast.error('Subject is required');
      return;
    }

    if (!message) {
      toast.error('Message is required');
      return;
    }

    setInquiryReplySending(true);
    try {
      await replyToAdInquiry(inquiryReply.inquiry.id, { subject, message });
      const nextReplyMeta: InquiryReplyMeta = {
        hasReply: true,
        lastRepliedAt: new Date().toISOString(),
        lastRepliedBy: inquiryReply.inquiry.lastRepliedBy || 'Admin',
        replyCount: (typeof inquiryReply.inquiry.replyCount === 'number' ? inquiryReply.inquiry.replyCount : 0) + 1,
        lastReplySubject: subject,
      };

      setInquiryReplyOverrides((prev) => ({
        ...prev,
        [inquiryReply.inquiry.id]: {
          ...prev[inquiryReply.inquiry.id],
          ...nextReplyMeta,
        },
      }));
      setInquiries((prev) => prev.map((item) => (
        item.id === inquiryReply.inquiry.id ? applyReplyMeta(item, nextReplyMeta) : item
      )));
      setInquiryView((prev) => (
        prev && prev.id === inquiryReply.inquiry.id ? applyReplyMeta(prev, nextReplyMeta) : prev
      ));
      toast.success('Reply sent to advertiser');
      setInquiryReply(null);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send reply');
    } finally {
      setInquiryReplySending(false);
    }
  }, [inquiryReply, inquiryReplySending]);

  const removeInquiriesFromState = React.useCallback((ids: string[]) => {
    const idSet = new Set(ids.map((id) => String(id || '').trim()).filter(Boolean));
    if (!idSet.size) return;

    setInquiries((prev) => prev.filter((item) => !idSet.has(String(item.id || '').trim())));
    setSelectedInquiryIds((prev) => prev.filter((id) => !idSet.has(String(id || '').trim())));
    setInquiryView((prev) => (prev && idSet.has(String(prev.id || '').trim()) ? null : prev));
    setInquiryReply((prev) => (prev && idSet.has(String(prev.inquiry.id || '').trim()) ? null : prev));
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

  type PlacementKey = PlacementSlotOption;
  type PlacementState = Record<PlacementKey, boolean>;

  const emptyPlacementState = React.useCallback((): PlacementState => {
    const next = {} as PlacementState;
    for (const key of PLACEMENT_SLOT_OPTIONS) next[key] = false;
    return next;
  }, []);

  const [slotEnabled, setSlotEnabled] = React.useState<PlacementState>(() => emptyPlacementState());

  const [settingsLoading, setSettingsLoading] = React.useState(true);
  const [placementSaving, setPlacementSaving] = React.useState<Record<PlacementKey, boolean>>(() => emptyPlacementState());

  const [slotFilter, setSlotFilter] = React.useState<AdSlot | 'ALL'>('ALL');
  const [activeOnly, setActiveOnly] = React.useState(false);

  const [modalOpen, setModalOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<AdFormState>(emptyForm);
  const [adImageFile, setAdImageFile] = React.useState<File | null>(null);
  const [adImageUploading, setAdImageUploading] = React.useState(false);
  const [adImageUploadProgress, setAdImageUploadProgress] = React.useState<number | null>(null);
  const [hostingExternalImage, setHostingExternalImage] = React.useState(false);
  const [adImagePreviewBroken, setAdImagePreviewBroken] = React.useState(false);

  const [rowBusy, setRowBusy] = React.useState<Record<string, boolean>>({});
  const [brokenImageByAdId, setBrokenImageByAdId] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    setAdImagePreviewBroken(false);
  }, [form.imageUrl]);

  const uploadAdImage = React.useCallback(async (file: File) => {
    const fd = new FormData();
    // Expected backend contract: field name "file".
    fd.append('file', file);

    const res = await api.post('/ads/upload-image', fd, {
      onUploadProgress: (evt) => {
        const total = typeof evt.total === 'number' ? evt.total : null;
        const loaded = typeof evt.loaded === 'number' ? evt.loaded : null;
        if (!total || !loaded) {
          setAdImageUploadProgress(null);
          return;
        }
        const pct = Math.max(0, Math.min(100, Math.round((loaded / total) * 100)));
        setAdImageUploadProgress(pct);
      },
    });
    const payload = res?.data;
    const hostedUrl = String(
      payload?.hostedUrl
      || payload?.hosted_url
      || payload?.data?.hostedUrl
      || payload?.data?.hosted_url
      || payload?.url
      || payload?.data?.url
      || ''
    ).trim();

    if (!hostedUrl) throw new Error('Upload succeeded but no hostedUrl was returned');

    // Prefer absolute https URLs; tolerate root-relative URLs from some backends.
    if (/^https?:\/\//i.test(hostedUrl)) return hostedUrl;
    if (hostedUrl.startsWith('/')) {
      try {
        if (typeof window !== 'undefined' && window.location?.origin) {
          return `${window.location.origin}${hostedUrl}`;
        }
      } catch {}
    }

    return hostedUrl;
  }, []);

  const handleUploadSelectedImage = React.useCallback(async (file?: File | null) => {
    const f = file || adImageFile;
    if (!f) {
      toast.error('Please choose an image file to upload');
      return;
    }

    setAdImageUploading(true);
    setAdImageUploadProgress(null);
    try {
      const url = await uploadAdImage(f);
      setForm((prev) => ({ ...prev, imageUrl: url }));
      toast.success('Image uploaded');
    } catch (err: any) {
      const msg =
        err?.response?.data?.message
        || err?.response?.data?.error
        || err?.response?.data?.data?.message
        || err?.message
        || 'Upload failed';
      toast.error(String(msg));
    } finally {
      setAdImageUploading(false);
      setAdImageUploadProgress(null);
    }
  }, [adImageFile, uploadAdImage]);

  const isExternalImageUrl = React.useCallback((url: string) => {
    const u = String(url || '').trim();
    if (!/^https?:\/\//i.test(u)) return false;
    try {
      if (typeof window !== 'undefined' && window.location?.origin) {
        return !u.startsWith(window.location.origin);
      }
    } catch {}
    return true;
  }, []);

  const hostExternalImageNow = React.useCallback(async () => {
    if (!editingId) return;
    const imageUrl = String(form.imageUrl || '').trim();
    if (!isExternalImageUrl(imageUrl)) return;
    if (!form.slot) {
      toast.error('Slot is required');
      return;
    }
    if (!form.title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (!imageUrl) {
      toast.error('Image URL is required');
      return;
    }
    if (form.clickable && !form.targetUrl.trim()) {
      toast.error('Target URL is required when Clickable Ad is enabled');
      return;
    }
    const priorityNum = Number(form.priority);
    if (!Number.isFinite(priorityNum)) {
      toast.error('Priority must be a number');
      return;
    }

    const startAtIso = fromDatetimeLocalValue(form.startAt);
    const endAtIso = fromDatetimeLocalValue(form.endAt);
    if (form.startAt.trim() && !startAtIso) {
      toast.error('Start At must be a valid date/time');
      return;
    }
    if (form.endAt.trim() && !endAtIso) {
      toast.error('End At must be a valid date/time');
      return;
    }
    if (startAtIso && endAtIso && new Date(startAtIso).getTime() > new Date(endAtIso).getTime()) {
      toast.error('Start At must be before End At');
      return;
    }

    setHostingExternalImage(true);
    try {
      const payload: any = {
        slot: canonicalSlot(form.slot),
        title: form.title.trim(),
        imageUrl,
        clickable: Boolean(form.clickable),
        isClickable: Boolean(form.clickable),
        targetUrl: form.clickable ? form.targetUrl.trim() : null,
        priority: priorityNum,
        startAt: startAtIso,
        endAt: endAtIso,
        isActive: Boolean(form.isActive),
      };
      payload.active = payload.isActive;

      const res = await adminApi.put(`/admin/ads/${editingId}`, payload);
      const updated = normalizeAd(res?.data?.ad ?? res?.data);
      if (updated?.imageUrl) {
        setForm((prev) => ({ ...prev, imageUrl: updated.imageUrl }));
      }
      toast.success('Image hosted');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to host image');
    } finally {
      setHostingExternalImage(false);
    }
  }, [adminApi, editingId, form, isExternalImageUrl]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setAdImageFile(null);
    setAdImageUploading(false);
    setAdImageUploadProgress(null);
    setHostingExternalImage(false);
    setAdImagePreviewBroken(false);
    setModalOpen(true);
  };

  const openEdit = (ad: SponsorAd) => {
    setEditingId(ad.id);
    const clickable = typeof ad.clickable === 'boolean' ? ad.clickable : Boolean((ad.targetUrl || '').toString().trim());
    setForm({
      slot: (canonicalSlot(ad.slot) as AdSlot) || '',
      title: String(ad.title ?? ''),
      imageUrl: ad.imageUrl || '',
      targetUrl: String(ad.targetUrl ?? ''),
      clickable,
      priority: String(ad.priority ?? 0),
      startAt: toDatetimeLocalValue(ad.startAt),
      endAt: toDatetimeLocalValue(ad.endAt),
      isActive: Boolean(ad.isActive),
    });
    setAdImageFile(null);
    setAdImageUploading(false);
    setAdImageUploadProgress(null);
    setHostingExternalImage(false);
    setAdImagePreviewBroken(false);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setAdImageFile(null);
    setAdImageUploading(false);
    setAdImageUploadProgress(null);
    setHostingExternalImage(false);
    setAdImagePreviewBroken(false);
  };

  const fetchAds = React.useCallback(async (opts?: {
    slot?: AdSlot | 'ALL';
    activeOnly?: boolean;
  }) => {
    setLoading(true);
    try {
      const params: any = {};
      const nextSlot = opts?.slot ?? slotFilter;
      const nextActiveOnly = typeof opts?.activeOnly === 'boolean' ? opts.activeOnly : activeOnly;

      if (nextSlot !== 'ALL') params.slot = nextSlot;
      if (nextActiveOnly) params.active = 'true';

      // Backend contract: GET /api/admin/ads
      // Use adminApi so proxy/direct mode is handled and auth headers are attached.
      const res = await adminApi.get('/admin/ads', { params });
      const payload = res?.data;

      const list = extractAdsList(payload);

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
      setInquiries(result.items.map((item) => applyReplyMeta(item, inquiryReplyOverridesRef.current[item.id])));
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
        removeInquiriesFromState(safeIds);
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
  }, [clearInquirySelection, refreshInquiryDataAfterBulk, removeInquiriesFromState]);

  const fetchAdSettings = React.useCallback(async (): Promise<PlacementState> => {
    const res = await adminApi.get('/admin/ad-settings');
    const raw = res?.data;
    const enabledRaw = (raw?.slotEnabled || raw?.data?.slotEnabled || {}) as any;
    const next = emptyPlacementState();
    for (const key of PLACEMENT_SLOT_OPTIONS) {
      next[key] = parseBool(enabledRaw[key]);
    }
    return next;
  }, [emptyPlacementState]);

  const updateAdSettings = React.useCallback(async (next: PlacementState): Promise<PlacementState> => {
    const res = await adminApi.put('/admin/ad-settings', { slotEnabled: next });
    const raw = res?.data;
    const enabledRaw = (raw?.slotEnabled || raw?.data?.slotEnabled || null) as any;
    if (!enabledRaw) return next;
    const saved = emptyPlacementState();
    for (const key of PLACEMENT_SLOT_OPTIONS) {
      saved[key] = parseBool(enabledRaw[key]);
    }
    return saved;
  }, [emptyPlacementState]);

  const loadSettings = React.useCallback(async () => {
    // IMPORTANT: do not overwrite local state while a save is in progress.
    if (PLACEMENT_SLOT_OPTIONS.some((key) => placementSaving[key])) return;
    setSettingsLoading(true);
    try {
      setSlotEnabled(await fetchAdSettings());
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to load ad placements');
    } finally {
      setSettingsLoading(false);
    }
  }, [fetchAdSettings, placementSaving]);

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

    if (!form.title.trim()) {
      toast.error('Title is required');
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

    const priorityNum = Number(form.priority);
    if (!Number.isFinite(priorityNum)) {
      toast.error('Priority must be a number');
      return;
    }

    const startAtIso = fromDatetimeLocalValue(form.startAt);
    const endAtIso = fromDatetimeLocalValue(form.endAt);

    if (form.startAt.trim() && !startAtIso) {
      toast.error('Start At must be a valid date/time');
      return;
    }
    if (form.endAt.trim() && !endAtIso) {
      toast.error('End At must be a valid date/time');
      return;
    }
    if (startAtIso && endAtIso && new Date(startAtIso).getTime() > new Date(endAtIso).getTime()) {
      toast.error('Start At must be before End At');
      return;
    }

    if (startAtIso && endAtIso && startAtIso === endAtIso) {
      const ok = window.confirm(
        'Warning: Start time and end time are the same. This creates a zero-length schedule window.\n\nSave anyway?'
      );
      if (!ok) return;
    }

    setSaving(true);
    try {
      const payload: any = {
        slot: canonicalSlot(form.slot),
        title: form.title.trim(),
        imageUrl: form.imageUrl.trim(),
        clickable: Boolean(form.clickable),
        isClickable: Boolean(form.clickable),
        targetUrl: form.clickable ? form.targetUrl.trim() : null,
        priority: priorityNum,
        startAt: startAtIso,
        endAt: endAtIso,
        isActive: Boolean(form.isActive),
      };

      // Back-compat: some backends use `active` instead of `isActive`.
      payload.active = payload.isActive;

      const normalizeAndUpsert = (raw: any) => {
        const next = normalizeAd(raw);
        if (!next.id) return;
        setAds((prev) => {
          const without = prev.filter((a) => a.id !== next.id);
          return [next, ...without];
        });

        // Ensure UI filters don't hide the newly created ad.
        if (slotFilter !== 'ALL' && slotFilter !== (next.slot as any)) {
          setSlotFilter(next.slot as any);
        }
        if (activeOnly && !next.isActive) {
          setActiveOnly(false);
        }
      };

      if (editingId) {
        // PUT /api/admin/ads/:id
        const res = await adminApi.put(`/admin/ads/${editingId}`, payload);
        normalizeAndUpsert(res?.data?.ad ?? res?.data);
        toast.success('Ad updated');
      } else {
        // POST /api/admin/ads
        const res = await adminApi.post('/admin/ads', payload);
        normalizeAndUpsert(res?.data?.ad ?? res?.data);
        toast.success('Ad created');
      }

      setModalOpen(false);

      const desiredSlot = (slotFilter !== 'ALL' && slotFilter !== (payload.slot as any))
        ? (payload.slot as any)
        : slotFilter;
      const desiredActiveOnly = activeOnly && Boolean(payload.isActive);
      await fetchAds({ slot: desiredSlot as any, activeOnly: desiredActiveOnly });
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
                    const isReplied = Boolean(inq.hasReply);
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
                        <td className="p-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {!isDeleted ? <span>{inq.status || 'new'}</span> : null}
                            {isDeleted ? (
                              <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700">
                                Deleted
                              </span>
                            ) : null}
                            {isReplied ? (
                              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                                Replied
                              </span>
                            ) : null}
                          </div>
                        </td>
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
                                  <button
                                    type="button"
                                    className="px-2 py-1 rounded border text-xs"
                                    disabled={busy || bulkBusy}
                                    onClick={() => openInquiryReplyComposer(inq)}
                                  >
                                    Reply
                                  </button>
                                ) : (
                                  <button type="button" className="px-2 py-1 rounded border text-xs" disabled>
                                    Reply
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
                                      removeInquiriesFromState([inq.id]);
                                      await refreshInquiryDataAfterBulk(1);
                                      toast.success('Inquiry deleted permanently');
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
                onClick={closeInquiryView}
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
                  <div className="font-medium">{inquiryView.email || '-'}</div>
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

              {inquiryView.hasReply ? (
                <div className="border rounded p-3 bg-slate-50 dark:bg-slate-950">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                      Replied
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-slate-500">Last replied at</div>
                      <div className="font-medium">{inquiryView.lastRepliedAt ? safeDateLabel(inquiryView.lastRepliedAt) : '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Last replied by</div>
                      <div className="font-medium">{inquiryView.lastRepliedBy || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Reply count</div>
                      <div className="font-medium">{typeof inquiryView.replyCount === 'number' ? inquiryView.replyCount : '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Last reply subject</div>
                      <div className="font-medium">{inquiryView.lastReplySubject || '-'}</div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t">
                <div className="text-xs text-slate-500">
                  Reply here to send a response from inside the admin panel.
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {canEmailFromCurrentTab && inquiryView.email ? (
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded border bg-slate-900 text-white border-slate-900 disabled:opacity-60"
                      onClick={() => openInquiryReplyComposer(inquiryView)}
                    >
                      Reply
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'inquiries' && inquiryReply ? (
        <div
          className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded border shadow">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="text-lg font-semibold">Reply to Advertiser</h3>
                <div className="text-xs text-slate-500">Compose and send your reply from inside the admin panel.</div>
              </div>
              <button
                type="button"
                onClick={closeInquiryReplyComposer}
                disabled={inquiryReplySending}
                className="px-2 py-1 rounded border disabled:opacity-60"
              >
                Close
              </button>
            </div>

            <form className="p-4 space-y-4" onSubmit={sendInquiryReply}>
              <div>
                <label className="block text-xs text-slate-500 mb-1">To</label>
                <input
                  type="text"
                  readOnly
                  value={inquiryReply.inquiry.email || ''}
                  className="w-full border rounded px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1">Subject</label>
                <input
                  type="text"
                  value={inquiryReply.subject}
                  onChange={(e) => setInquiryReply((prev) => (prev ? { ...prev, subject: e.target.value } : prev))}
                  disabled={inquiryReplySending}
                  className="w-full border rounded px-3 py-2 text-sm bg-white dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1">Message</label>
                <textarea
                  rows={8}
                  value={inquiryReply.message}
                  onChange={(e) => setInquiryReply((prev) => (prev ? { ...prev, message: e.target.value } : prev))}
                  disabled={inquiryReplySending}
                  autoFocus
                  placeholder="Write your reply to the advertiser"
                  className="w-full border rounded px-3 py-2 text-sm bg-white dark:bg-slate-950"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded border"
                  disabled={inquiryReplySending}
                  onClick={closeInquiryReplyComposer}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded border bg-slate-900 text-white border-slate-900 disabled:opacity-60"
                  disabled={inquiryReplySending}
                >
                  {inquiryReplySending ? 'Sending…' : 'Send'}
                </button>
              </div>
            </form>
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
          {PLACEMENT_SLOT_OPTIONS.map((key) => (
            <div
              key={key}
              className="border rounded p-3 bg-slate-50 dark:bg-slate-950 flex items-center justify-between gap-3"
            >
              <div>
                <div className="text-sm font-medium">{slotLabel(key)}</div>
                <div className="text-xs text-slate-500 font-mono">{key}</div>
              </div>
              <button
                type="button"
                disabled={settingsLoading || placementSaving[key]}
                onClick={() => void togglePlacement(key)}
                className={`px-3 py-1 rounded text-xs border min-w-[84px] ${placementSaving[key] ? 'cursor-not-allowed opacity-80' : ''} ${slotEnabled[key] ? 'bg-green-600 text-white border-green-600' : 'bg-slate-200 text-slate-700 border-slate-300'}`}
                title="Toggle placement"
              >
                {placementSaving[key] ? 'Saving…' : (slotEnabled[key] ? 'ON' : 'OFF')}
              </button>
            </div>
          ))}
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
                const isBrokenImage = Boolean(ad.imageUrl) && Boolean(brokenImageByAdId[ad.id]);

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
                            <img
                              src={ad.imageUrl}
                              alt={ad.title || ad.slot}
                              className="max-w-full max-h-full object-contain"
                              onError={() => setBrokenImageByAdId((prev) => ({ ...prev, [ad.id]: true }))}
                              onLoad={() => setBrokenImageByAdId((prev) => (prev[ad.id] ? ({ ...prev, [ad.id]: false }) : prev))}
                            />
                          ) : (
                            <span className="text-xs text-slate-400">No image</span>
                          )}
                        </div>
                        {isBrokenImage ? (
                          <span className="text-[11px] text-red-700">Image URL invalid</span>
                        ) : (
                          <span className="text-[11px] text-slate-500">Click target</span>
                        )}
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
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-3 py-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-white dark:bg-slate-900 rounded border shadow flex flex-col overflow-hidden"
            style={{
              maxHeight: 'calc(100vh - 32px)',
              width: 'min(920px, calc(100vw - 24px))',
            }}
          >
            <div className="flex items-center justify-between p-4 border-b flex-none">
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

            <form onSubmit={submit} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 min-h-0 overflow-y-auto py-5 px-6 overscroll-contain">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Slot *</label>
                  {editingId && isLegacySlot(form.slot) ? (
                    <div className="w-full border rounded px-2 py-2 bg-slate-50 dark:bg-slate-950">
                      <div className="text-sm">{slotLabel(String(form.slot))}</div>
                      <div className="text-xs text-slate-500 font-mono">{canonicalSlot(form.slot)}</div>
                    </div>
                  ) : (
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
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Title *</label>
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

                  {isExternalImageUrl(form.imageUrl) ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="px-3 py-1.5 rounded border text-sm disabled:opacity-60"
                        disabled={saving || hostingExternalImage || !editingId}
                        onClick={() => void hostExternalImageNow()}
                        title={editingId ? 'Ask backend to re-host this image' : 'Create the ad first, then you can host the image'}
                      >
                        {hostingExternalImage ? 'Hosting…' : 'Host this image'}
                      </button>
                      {!editingId ? (
                        <span className="text-xs text-slate-500">Will be hosted on Create Ad</span>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      className="text-sm"
                      disabled={adImageUploading}
                      onChange={(e) => {
                        const f = e.currentTarget.files?.[0] || null;
                        setAdImageFile(f);
                      }}
                    />
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded border text-sm disabled:opacity-60"
                      disabled={adImageUploading || !adImageFile}
                      onClick={() => void handleUploadSelectedImage()}
                      title="Upload selected image"
                    >
                      {adImageUploading
                        ? (typeof adImageUploadProgress === 'number' ? `Uploading… ${adImageUploadProgress}%` : 'Uploading…')
                        : 'Upload Image'}
                    </button>
                    <span className="text-xs text-slate-500">Or paste a URL above</span>
                  </div>

                  {form.imageUrl ? (
                    <div className="mt-2 flex items-center gap-3">
                      <div className="w-[180px] h-[60px] bg-slate-100 dark:bg-slate-900 border rounded overflow-hidden flex items-center justify-center">
                        {adImagePreviewBroken ? (
                          <span className="text-xs text-red-700">Preview failed</span>
                        ) : (
                          <img
                            src={form.imageUrl}
                            alt={form.title || form.slot || 'Ad image'}
                            className="max-w-full max-h-full object-contain"
                            onError={() => setAdImagePreviewBroken(true)}
                            onLoad={() => setAdImagePreviewBroken(false)}
                          />
                        )}
                      </div>
                      <div className="text-xs text-slate-500">Preview</div>
                    </div>
                  ) : null}
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

                </div>
              </div>

              <div className="sticky bottom-0 bg-white dark:bg-slate-900 py-4 px-6 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-700 z-[2]">
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
