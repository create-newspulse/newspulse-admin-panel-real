import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  CalendarDays,
  Copy,
  Eye,
  Grid2X2,
  Image as ImageIcon,
  Link2,
  List,
  Pencil,
  RefreshCcw,
  RotateCcw,
  ScanSearch,
  Search,
  Sparkles,
  Trash2,
  Upload,
  Video,
  Play,
  X,
} from 'lucide-react';
import apiClient from '@/lib/api';
import { getMediaStatus, type MediaStatus } from '@/lib/api/media';
import { useAuth } from '@/context/AuthContext';

type MediaType = 'image' | 'video';
type MediaTab = 'all' | 'photos' | 'videos' | 'trash';
type ViewMode = 'grid' | 'list' | 'timeline';
type DatePreset = 'all' | 'today' | 'this-week' | 'this-month' | 'this-year' | 'custom';
type UsageFilter = 'all' | 'used' | 'unused';
type StatusFilter = 'all' | 'active' | 'deleted';
type MediaSource = 'admin upload' | 'article upload' | 'community reporter' | 'reporter portal' | 'other system upload';

type LinkedContent = {
  id: string;
  title: string;
  kind: 'article' | 'story' | 'page' | 'other';
  path?: string;
  status?: string;
};

type MediaItem = {
  id: string;
  url: string;
  thumbnailUrl: string;
  posterUrl?: string;
  filename: string;
  mediaType: MediaType;
  mimeType?: string;
  uploadedAt?: string;
  deletedAt?: string;
  uploadedBy: string;
  source: MediaSource;
  fileSize?: number;
  usageCount: number;
  linkedContent: LinkedContent[];
  rights?: string;
  width?: number;
  height?: number;
  altText?: string;
  caption?: string;
  archived?: boolean;
  hiddenFromFutureSelection?: boolean;
  isDeleted: boolean;
  replaceWithId?: string;
};

type MediaOverride = Partial<MediaItem> & {
  removed?: boolean;
};

type TimelineDayGroup = {
  key: string;
  label: string;
  items: MediaItem[];
};

type TimelineMonthGroup = {
  key: string;
  label: string;
  days: TimelineDayGroup[];
};

type TimelineYearGroup = {
  key: string;
  label: string;
  months: TimelineMonthGroup[];
};

const STORAGE_KEY = 'np_admin_media_library_overrides_v2';
const MEDIA_LIBRARY_LIST_ROUTE = '/uploads';
const MEDIA_LIBRARY_EFFECTIVE_LIST_ROUTE = '/admin-api/uploads';
const MEDIA_LIBRARY_STATUS_ROUTE = '/admin-api/media/status';
const ALLOWED_MEDIA_MIME_TYPES = ['image/jpeg', 'image/png', 'video/mp4'] as const;
const ALLOWED_MEDIA_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.mp4'] as const;
const REJECTED_FORMATS_MESSAGE = 'Only JPG, JPEG, PNG images and MP4 videos are allowed.';
const DEV_MEDIA_ORIGIN = 'http://localhost:5000';
const MIN_IMAGE_PREVIEW_BYTES = 32;
const MIN_VIDEO_PREVIEW_BYTES = 1024;

const SOURCE_OPTIONS: MediaSource[] = [
  'admin upload',
  'article upload',
  'community reporter',
  'reporter portal',
  'other system upload',
];

const SOURCE_STYLES: Record<MediaSource, string> = {
  'admin upload': 'bg-sky-50 text-sky-700 border-sky-200',
  'article upload': 'bg-violet-50 text-violet-700 border-violet-200',
  'community reporter': 'bg-amber-50 text-amber-700 border-amber-200',
  'reporter portal': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'other system upload': 'bg-slate-100 text-slate-700 border-slate-200',
};

function safeText(value: unknown, fallback = ''): string {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function safeNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isAllowedMediaFile(file: File): boolean {
  const fileName = safeText(file?.name).toLowerCase();
  const fileType = safeText(file?.type).toLowerCase();
  const mimeOk = ALLOWED_MEDIA_MIME_TYPES.includes(fileType as (typeof ALLOWED_MEDIA_MIME_TYPES)[number]);
  const extensionOk = ALLOWED_MEDIA_EXTENSIONS.some((ext) => fileName.endsWith(ext));
  return mimeOk && extensionOk;
}

function readOverrides(): Record<string, MediaOverride> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, MediaOverride> : {};
  } catch {
    return {};
  }
}

function formatDateTime(value?: string): string {
  const s = safeText(value);
  if (!s) return 'Unknown date';
  const date = new Date(s);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleString();
}

function formatDayLabel(value?: string): string {
  const s = safeText(value);
  if (!s) return 'Unknown day';
  const date = new Date(s);
  if (Number.isNaN(date.getTime())) return 'Unknown day';
  return date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function formatMonthLabel(value: Date): string {
  return value.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
}

function formatFileSize(bytes?: number): string {
  if (!bytes || !Number.isFinite(bytes) || bytes <= 0) return 'Unknown size';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

function formatKindLabel(kind: LinkedContent['kind']): string {
  if (kind === 'article') return 'Article';
  if (kind === 'story') return 'Story';
  if (kind === 'page') return 'Page';
  return 'Other content';
}

function normalizeMediaUrl(value: unknown): string {
  const normalized = safeText(value).trim();
  if (!normalized) return '';
  return normalized.replace(/\?.*$/, '').replace(/#.*$/, '');
}

function isAbsoluteHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function isLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function buildDevAssetUrl(path: string): string {
  if (!path) return '';
  return `${DEV_MEDIA_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}

function resolveAssetUrl(primary: unknown, relative?: unknown): string {
  const primaryText = safeText(primary);
  const relativeText = safeText(relative);

  if (primaryText && isAbsoluteHttpUrl(primaryText)) {
    try {
      const parsed = new URL(primaryText);
      if (
        import.meta.env.DEV
        && relativeText.startsWith('/')
        && isLoopbackHostname(parsed.hostname)
        && parsed.port
        && parsed.port !== '5000'
      ) {
        return buildDevAssetUrl(relativeText);
      }
      return parsed.toString();
    } catch {
      return primaryText;
    }
  }

  if (primaryText.startsWith('/')) {
    return import.meta.env.DEV ? buildDevAssetUrl(primaryText) : primaryText;
  }

  if (relativeText.startsWith('/')) {
    return import.meta.env.DEV ? buildDevAssetUrl(relativeText) : relativeText;
  }

  return primaryText || relativeText;
}

function isClearlyInvalidAsset(item: Pick<MediaItem, 'mediaType' | 'fileSize'>): boolean {
  const size = safeNumber(item.fileSize) ?? 0;
  if (!size) return false;
  return item.mediaType === 'video'
    ? size < MIN_VIDEO_PREVIEW_BYTES
    : size < MIN_IMAGE_PREVIEW_BYTES;
}

function getPreviewModel(item: MediaItem) {
  const fullUrl = safeText(item.url);
  const thumbnailUrl = safeText(item.thumbnailUrl || item.url);
  const posterUrl = safeText(item.posterUrl || item.thumbnailUrl || item.url);
  const clearlyInvalid = isClearlyInvalidAsset(item);
  const missingFullUrl = !fullUrl;

  return {
    fullUrl,
    thumbnailUrl,
    posterUrl,
    clearlyInvalid,
    missingFullUrl,
    previewUnavailable: clearlyInvalid || missingFullUrl,
    errorTitle: 'Preview unavailable',
    errorDetail: missingFullUrl
      ? 'Asset URL is missing from the library record.'
      : 'Asset may be incomplete or corrupted.',
  };
}

function extractUploadsItems(raw: any): any[] {
  const candidates = [
    raw?.items,
    raw?.data?.items,
    raw?.data?.data?.items,
    raw?.data,
    raw,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  return [];
}

function inferMediaType(input: any): MediaType {
  const explicit = safeText(input?.mediaType || input?.type || input?.mimeType || input?.mime || input?.contentType).toLowerCase();
  if (explicit.includes('video')) return 'video';
  if (explicit.includes('image')) return 'image';
  if (explicit.includes('photo') || explicit.includes('picture')) return 'image';

  const name = safeText(input?.filename || input?.name || input?.url || input?.path).toLowerCase();
  if (/\.(mp4|mov|m4v|webm|ogg|ogv|avi|mkv)$/.test(name)) return 'video';
  return 'image';
}

function normalizeSource(raw: any): MediaSource {
  const text = safeText(raw).toLowerCase();
  if (!text) return 'other system upload';
  if (text.includes('portal')) return 'reporter portal';
  if (text.includes('community')) return 'community reporter';
  if (text.includes('article') || text.includes('cover') || text.includes('editor')) return 'article upload';
  if (text.includes('admin') || text.includes('founder')) return 'admin upload';
  return 'other system upload';
}

function extractUploadedBy(raw: any): string {
  const direct = raw?.uploadedBy || raw?.uploadedByName || raw?.uploaderName || raw?.ownerName || raw?.createdByName || raw?.authorName;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  const objectCandidate = raw?.uploadedByUser || raw?.uploader || raw?.owner || raw?.createdBy || raw?.author;
  if (objectCandidate && typeof objectCandidate === 'object') {
    const label = safeText(objectCandidate.name || objectCandidate.email || objectCandidate.username);
    if (label) return label;
  }
  const email = safeText(raw?.uploadedByEmail || raw?.uploaderEmail || raw?.ownerEmail || raw?.createdByEmail);
  return email || 'System';
}

function normalizeLinkedEntry(entry: any, fallbackKind: LinkedContent['kind']): LinkedContent | null {
  if (!entry) return null;
  if (typeof entry === 'string') {
    const text = entry.trim();
    if (!text) return null;
    return {
      id: text,
      title: text,
      kind: fallbackKind,
      path: text.startsWith('/') ? text : undefined,
    };
  }

  const id = safeText(entry.id || entry._id || entry.slug || entry.path || entry.url || entry.title);
  const title = safeText(entry.title || entry.headline || entry.name || entry.slug || id, 'Untitled reference');
  if (!id && !title) return null;

  const rawKind = safeText(entry.kind || entry.type || entry.contentType).toLowerCase();
  const kind: LinkedContent['kind'] = rawKind === 'article'
    ? 'article'
    : rawKind === 'story'
      ? 'story'
      : rawKind === 'page'
        ? 'page'
        : fallbackKind;

  return {
    id: id || title,
    title,
    kind,
    path: safeText(entry.path || entry.url || entry.route) || undefined,
    status: safeText(entry.status) || undefined,
  };
}

function extractLinkedContent(raw: any): LinkedContent[] {
  const collections: Array<{ value: any; kind: LinkedContent['kind'] }> = [
    { value: raw?.linkedContent, kind: 'other' },
    { value: raw?.usedIn, kind: 'other' },
    { value: raw?.references, kind: 'other' },
    { value: raw?.usage?.items, kind: 'other' },
    { value: raw?.usage, kind: 'other' },
    { value: raw?.articles, kind: 'article' },
    { value: raw?.stories, kind: 'story' },
    { value: raw?.pages, kind: 'page' },
  ];

  const items: LinkedContent[] = [];
  collections.forEach(({ value, kind }) => {
    if (!value) return;
    const arr = Array.isArray(value) ? value : (typeof value === 'object' ? [value] : []);
    arr.forEach((entry) => {
      const normalized = normalizeLinkedEntry(entry, kind);
      if (!normalized) return;
      if (items.some((item) => item.id === normalized.id && item.kind === normalized.kind)) return;
      items.push(normalized);
    });
  });
  return items;
}

function normalizeMediaItem(raw: any): MediaItem {
  const linkedContent = extractLinkedContent(raw);
  const usageCount = safeNumber(raw?.usageCount ?? raw?.usedCount ?? raw?.referencesCount ?? raw?.usage?.count) ?? linkedContent.length;
  const uploadedAt = safeText(raw?.uploadedAt || raw?.createdAt || raw?.updatedAt || raw?.date);
  const deletedAt = safeText(raw?.deletedAt || raw?.trashedAt || raw?.archivedAt);
  const source = normalizeSource(raw?.source || raw?.uploadSource || raw?.origin || raw?.module || raw?.context);
  const filename = safeText(raw?.filename || raw?.name || raw?.originalName || raw?.title || raw?.url, 'Untitled media');
  const relativeUrl = safeText(raw?.relativeUrl || raw?.relativePath || raw?.file?.relativeUrl, '');
  const mediaType = inferMediaType(raw);
  const url = resolveAssetUrl(raw?.url || raw?.path || raw?.secure_url || raw?.secureUrl || raw?.location, relativeUrl);
  const thumbnailUrl = resolveAssetUrl(raw?.thumbnailUrl || raw?.previewUrl || raw?.poster || raw?.posterUrl, relativeUrl) || url;
  const posterUrl = mediaType === 'video'
    ? (resolveAssetUrl(raw?.poster || raw?.posterUrl || raw?.thumbnailUrl || raw?.previewUrl, relativeUrl) || thumbnailUrl || url)
    : undefined;

  return {
    id: safeText(raw?.id || raw?._id || raw?.publicId || raw?.filename || raw?.url || filename),
    url,
    thumbnailUrl,
    posterUrl,
    filename,
    mediaType,
    mimeType: safeText(raw?.mimeType || raw?.mime || raw?.contentType) || undefined,
    uploadedAt: uploadedAt || undefined,
    deletedAt: deletedAt || undefined,
    uploadedBy: extractUploadedBy(raw),
    source,
    fileSize: safeNumber(raw?.bytes ?? raw?.size ?? raw?.fileSize),
    usageCount,
    linkedContent,
    rights: safeText(raw?.rights || raw?.license) || undefined,
    width: safeNumber(raw?.width),
    height: safeNumber(raw?.height),
    altText: safeText(raw?.altText || raw?.aiAltText || raw?.alt || raw?.metadata?.altText) || undefined,
    caption: safeText(raw?.caption || raw?.metadata?.caption) || undefined,
    archived: !!raw?.archived,
    hiddenFromFutureSelection: !!raw?.hiddenFromFutureSelection,
    isDeleted: !!(deletedAt || raw?.isDeleted || raw?.deleted || safeText(raw?.status).toLowerCase() === 'trash'),
    replaceWithId: safeText(raw?.replaceWithId || raw?.replacementTargetId) || undefined,
  };
}

function mergeMediaWithOverride(item: MediaItem, override?: MediaOverride): MediaItem {
  if (!override) return item;
  const linkedContent = Array.isArray(override.linkedContent) ? override.linkedContent : item.linkedContent;
  const usageCount = safeNumber(override.usageCount) ?? linkedContent.length ?? item.usageCount;
  return {
    ...item,
    ...override,
    linkedContent,
    usageCount,
    isDeleted: typeof override.isDeleted === 'boolean' ? override.isDeleted : item.isDeleted,
  };
}

function didRefreshIncludeUploadedAsset(items: MediaItem[], rawUpload: any, file: File): boolean {
  const uploadPayload = rawUpload?.data && typeof rawUpload.data === 'object' ? rawUpload.data : rawUpload;
  const uploadedUrlCandidates = [
    uploadPayload?.url,
    uploadPayload?.secureUrl,
    uploadPayload?.secure_url,
    uploadPayload?.file?.url,
    uploadPayload?.item?.url,
    uploadPayload?.data?.url,
  ]
    .map((value) => normalizeMediaUrl(value))
    .filter(Boolean);

  const uploadedIdCandidates = [
    uploadPayload?.id,
    uploadPayload?.publicId,
    uploadPayload?.public_id,
    uploadPayload?.filename,
    file.name,
  ]
    .map((value) => safeText(value).toLowerCase())
    .filter(Boolean);

  return items.some((item) => {
    const itemUrl = normalizeMediaUrl(item.url);
    const itemThumb = normalizeMediaUrl(item.thumbnailUrl);
    const itemId = safeText(item.id).toLowerCase();
    const itemFilename = safeText(item.filename).toLowerCase();

    return uploadedUrlCandidates.includes(itemUrl)
      || uploadedUrlCandidates.includes(itemThumb)
      || uploadedIdCandidates.includes(itemId)
      || uploadedIdCandidates.includes(itemFilename);
  });
}

function getStartOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function getStartOfWeek(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
}

function getStartOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function getStartOfYear(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), 0, 1);
}

function isWithinDateFilter(item: MediaItem, preset: DatePreset, from?: string, to?: string): boolean {
  const raw = safeText(item.uploadedAt || item.deletedAt);
  if (!raw) return preset === 'all';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return preset === 'all';
  if (preset === 'all') return true;
  if (preset === 'today') return date >= getStartOfToday();
  if (preset === 'this-week') return date >= getStartOfWeek();
  if (preset === 'this-month') return date >= getStartOfMonth();
  if (preset === 'this-year') return date >= getStartOfYear();
  if (preset === 'custom') {
    const afterFrom = from ? date >= new Date(`${from}T00:00:00`) : true;
    const beforeTo = to ? date <= new Date(`${to}T23:59:59`) : true;
    return afterFrom && beforeTo;
  }
  return true;
}

function buildTimelineGroups(items: MediaItem[]): TimelineYearGroup[] {
  const years = new Map<string, Map<string, Map<string, MediaItem[]>>>();

  items.forEach((item) => {
    const base = safeText(item.uploadedAt || item.deletedAt);
    const date = base ? new Date(base) : null;
    const validDate = date && !Number.isNaN(date.getTime()) ? date : new Date(0);
    const yearKey = String(validDate.getFullYear());
    const monthKey = `${yearKey}-${String(validDate.getMonth() + 1).padStart(2, '0')}`;
    const dayKey = `${monthKey}-${String(validDate.getDate()).padStart(2, '0')}`;

    if (!years.has(yearKey)) years.set(yearKey, new Map());
    const months = years.get(yearKey)!;
    if (!months.has(monthKey)) months.set(monthKey, new Map());
    const days = months.get(monthKey)!;
    if (!days.has(dayKey)) days.set(dayKey, []);
    days.get(dayKey)!.push(item);
  });

  return Array.from(years.entries())
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .map(([yearKey, months]) => ({
      key: yearKey,
      label: yearKey === '0' ? 'Unknown year' : yearKey,
      months: Array.from(months.entries())
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([monthKey, days]) => {
          const [year, month] = monthKey.split('-');
          const monthDate = new Date(Number(year), Number(month) - 1, 1);
          return {
            key: monthKey,
            label: Number(year) > 0 ? formatMonthLabel(monthDate) : 'Unknown month',
            days: Array.from(days.entries())
              .sort((a, b) => b[0].localeCompare(a[0]))
              .map(([dayKey, dayItems]) => ({
                key: dayKey,
                label: formatDayLabel(dayItems[0]?.uploadedAt || dayItems[0]?.deletedAt),
                items: [...dayItems].sort((a, b) => safeText(b.uploadedAt).localeCompare(safeText(a.uploadedAt))),
              })),
          };
        }),
    }));
}

function getMediaTypeLabel(type: MediaType): string {
  return type === 'video' ? 'Video' : 'Photo';
}

function StatCard({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-3 text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white/90 p-10 text-center shadow-sm">
      <div className="text-lg font-semibold text-slate-900">{title}</div>
      <div className="mt-2 text-sm text-slate-500">{detail}</div>
    </div>
  );
}

function PreviewFallback({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-slate-900 px-3 text-center text-white">
      <div className={`${compact ? 'text-xs' : 'text-sm'} font-semibold`}>Preview unavailable</div>
      <div className={`${compact ? 'text-[11px]' : 'text-xs'} text-slate-200`}>Asset may be incomplete or corrupted</div>
    </div>
  );
}

function VideoPlaceholder({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-slate-950 text-white">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/10">
        <Play className="ml-0.5 h-5 w-5" />
      </div>
      <div className={`${compact ? 'text-xs' : 'text-sm'} font-medium text-slate-100`}>Video preview</div>
    </div>
  );
}

function PreviewTile({ item }: { item: MediaItem }) {
  const preview = getPreviewModel(item);
  const [assetError, setAssetError] = useState(false);

  useEffect(() => {
    setAssetError(false);
  }, [item.id, item.thumbnailUrl, item.posterUrl, item.url]);

  if (preview.clearlyInvalid) {
    return <PreviewFallback compact />;
  }

  if (item.mediaType === 'video') {
    if (!preview.posterUrl || assetError) {
      return <VideoPlaceholder compact />;
    }

    return (
      <div className="relative h-full w-full">
        <img
          src={preview.posterUrl}
          alt={item.altText || item.filename}
          className="h-full w-full object-cover"
          onError={() => setAssetError(true)}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/45 via-transparent to-transparent" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-slate-950/65 text-white shadow-lg">
            <Play className="ml-0.5 h-5 w-5" />
          </div>
        </div>
      </div>
    );
  }

  const imageSrc = preview.thumbnailUrl || preview.fullUrl;

  if (!imageSrc || assetError) {
    return <PreviewFallback compact />;
  }

  return (
    <img
      src={imageSrc}
      alt={item.altText || item.filename}
      className="h-full w-full object-cover"
      onError={() => setAssetError(true)}
    />
  );
}

export default function MediaLibrary(): JSX.Element {
  const { isFounder } = useAuth();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [mediaStatus, setMediaStatus] = useState<MediaStatus | null>(null);
  const [overrides, setOverrides] = useState<Record<string, MediaOverride>>(() => readOverrides());
  const [tab, setTab] = useState<MediaTab>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | MediaSource>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | MediaType>('all');
  const [uploadedByFilter, setUploadedByFilter] = useState('all');
  const [usageFilter, setUsageFilter] = useState<UsageFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftFilename, setDraftFilename] = useState('');
  const [draftAltText, setDraftAltText] = useState('');
  const [draftCaption, setDraftCaption] = useState('');
  const [replaceTargetId, setReplaceTargetId] = useState('');
  const [forceDeleteArmed, setForceDeleteArmed] = useState(false);
  const [lastUploadNote, setLastUploadNote] = useState('');
  const [viewerItem, setViewerItem] = useState<MediaItem | null>(null);
  const [viewerError, setViewerError] = useState('');
  const [pendingTrashItem, setPendingTrashItem] = useState<MediaItem | null>(null);
  const [selectedTrashIds, setSelectedTrashIds] = useState<string[]>([]);
  const [pendingPermanentDeleteItems, setPendingPermanentDeleteItems] = useState<MediaItem[] | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
    } catch {
      // ignore persistence errors
    }
  }, [overrides]);

  useEffect(() => {
    void fetchMedia();
    void (async () => {
      const status = await getMediaStatus(apiClient);
      setMediaStatus(status);
    })();
  }, []);

  const uploadStatusReason = safeText(mediaStatus?.reason);
  const uploadStatusMessage = safeText(mediaStatus?.message);
  const uploadStatusDetail = safeText(mediaStatus?.detail);
  const uploadStatusPending = mediaStatus === null;
  const uploadStatusUnknown = uploadStatusReason === 'media_status_endpoint_unavailable';
  const uploadEnabled = mediaStatus?.uploadEnabled === true;
  const canAttemptUpload = uploadEnabled || uploadStatusUnknown;
  const uploadStatusLabel = uploadStatusPending
    ? 'Checking upload availability…'
    : uploadEnabled
      ? 'Uploads available'
      : uploadStatusReason === 'cloudinary_not_configured'
        ? (uploadStatusMessage || 'Upload not configured')
        : uploadStatusReason === 'media_status_endpoint_unavailable'
          ? 'Upload status endpoint unavailable. Upload will try the configured backend routes.'
          : uploadStatusReason === 'media_status_request_failed'
            ? (uploadStatusMessage || 'Could not verify upload service')
            : (uploadStatusMessage || 'Upload unavailable');
  const uploadButtonTitle = !canAttemptUpload
    ? (uploadStatusDetail || uploadStatusMessage || 'Upload not configured')
    : uploadStatusUnknown
      ? 'Upload status could not be verified. The upload flow will try /media/upload and then /uploads/cover.'
      : undefined;

  const mergedItems = useMemo(() => {
    return items
      .filter((item) => !overrides[item.id]?.removed)
      .map((item) => mergeMediaWithOverride(item, overrides[item.id]));
  }, [items, overrides]);

  const tabCounts = useMemo(() => ({
    all: mergedItems.filter((item) => !item.isDeleted).length,
    photos: mergedItems.filter((item) => !item.isDeleted && item.mediaType === 'image').length,
    videos: mergedItems.filter((item) => !item.isDeleted && item.mediaType === 'video').length,
    trash: mergedItems.filter((item) => item.isDeleted).length,
  }), [mergedItems]);

  const uploadedByOptions = useMemo(() => {
    return Array.from(new Set(mergedItems.map((item) => item.uploadedBy).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [mergedItems]);

  const showDeletedItems = tab === 'trash' || statusFilter === 'deleted';
  const isTrashManagementView = showDeletedItems;

  const visibleItems = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return mergedItems.filter((item) => {
      if (showDeletedItems) {
        if (!item.isDeleted) return false;
      } else if (item.isDeleted) {
        return false;
      }
      if (tab === 'photos' && item.mediaType !== 'image') return false;
      if (tab === 'videos' && item.mediaType !== 'video') return false;
      if (sourceFilter !== 'all' && item.source !== sourceFilter) return false;
      if (typeFilter !== 'all' && item.mediaType !== typeFilter) return false;
      if (usageFilter === 'used' && item.usageCount === 0) return false;
      if (usageFilter === 'unused' && item.usageCount > 0) return false;
      if (statusFilter === 'active' && item.isDeleted) return false;
      if (statusFilter === 'deleted' && !item.isDeleted) return false;
      if (uploadedByFilter !== 'all' && item.uploadedBy !== uploadedByFilter) return false;
      if (!isWithinDateFilter(item, datePreset, fromDate || undefined, toDate || undefined)) return false;
      if (!needle) return true;

      const haystack = [
        item.filename,
        item.url,
        item.source,
        item.uploadedBy,
        item.altText,
        item.caption,
        ...item.linkedContent.map((entry) => `${entry.title} ${entry.path || ''}`),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [mergedItems, showDeletedItems, tab, sourceFilter, typeFilter, usageFilter, statusFilter, uploadedByFilter, datePreset, fromDate, toDate, search]);

  const selectedTrashItems = useMemo(() => {
    if (selectedTrashIds.length === 0) return [];
    return mergedItems.filter((item) => item.isDeleted && selectedTrashIds.includes(item.id));
  }, [mergedItems, selectedTrashIds]);

  const visibleTrashIds = useMemo(() => visibleItems.filter((item) => item.isDeleted).map((item) => item.id), [visibleItems]);
  const allVisibleTrashSelected = visibleTrashIds.length > 0 && visibleTrashIds.every((id) => selectedTrashIds.includes(id));
  const pendingDeleteHasBlockedUsedItems = !!pendingPermanentDeleteItems?.some((item) => item.usageCount > 0 && !isFounder);

  const timelineGroups = useMemo(() => buildTimelineGroups(visibleItems), [visibleItems]);

  const selectedItem = useMemo(() => mergedItems.find((item) => item.id === selectedId) || null, [mergedItems, selectedId]);

  useEffect(() => {
    if (selectedItem) {
      setDraftFilename(selectedItem.filename);
      setDraftAltText(selectedItem.altText || '');
      setDraftCaption(selectedItem.caption || '');
      setReplaceTargetId(selectedItem.replaceWithId || '');
      setForceDeleteArmed(false);
      return;
    }
    setDraftFilename('');
    setDraftAltText('');
    setDraftCaption('');
    setReplaceTargetId('');
    setForceDeleteArmed(false);
  }, [selectedItem]);

  useEffect(() => {
    if (!selectedId) return;
    if (mergedItems.some((item) => item.id === selectedId)) return;
    setSelectedId(null);
  }, [mergedItems, selectedId]);

  useEffect(() => {
    setSelectedTrashIds((current) => current.filter((id) => mergedItems.some((item) => item.id === id && item.isDeleted)));
  }, [mergedItems]);

  useEffect(() => {
    if (!isTrashManagementView) {
      setSelectedTrashIds([]);
    }
  }, [isTrashManagementView]);

  useEffect(() => {
    if (!viewerItem) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setViewerItem(null);
        setViewerError('');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [viewerItem]);

  const canPermanentlyDeleteSelected = !!selectedItem
    && selectedItem.isDeleted
    && (selectedItem.usageCount === 0 || (isFounder && forceDeleteArmed));

  async function fetchMedia(opts?: { bustCache?: boolean }): Promise<MediaItem[]> {
    setLoading(true);
    const requestUrl = opts?.bustCache
      ? `${MEDIA_LIBRARY_EFFECTIVE_LIST_ROUTE}?_ts=<timestamp>`
      : MEDIA_LIBRARY_EFFECTIVE_LIST_ROUTE;
    try {
      const res = await apiClient.get(MEDIA_LIBRARY_LIST_ROUTE, {
        params: opts?.bustCache ? { _ts: Date.now() } : undefined,
        headers: opts?.bustCache
          ? {
              'Cache-Control': 'no-cache',
              Pragma: 'no-cache',
            }
          : undefined,
        // @ts-expect-error custom flag consumed by api.ts interceptor
        skipErrorLog: true,
      });
      const normalized = extractUploadsItems(res?.data)
        .map((item) => normalizeMediaItem(item))
        .filter((item) => item.url);
      setItems(normalized);
      return normalized;
    } catch (err: any) {
      const parsedMessage = String(
        err?.response?.data?.message
          || err?.response?.data?.error
          || err?.message
          || 'Unknown error'
      );
      console.error('Failed to fetch media', {
        route: MEDIA_LIBRARY_LIST_ROUTE,
        effectiveRoute: requestUrl,
        status: err?.response?.status ?? null,
        parsedMessage,
        responseBody: err?.response?.data ?? null,
      });
      setLastUploadNote(parsedMessage);
      return [];
    } finally {
      setLoading(false);
    }
  }

  function updateOverride(id: string, patch: MediaOverride) {
    setOverrides((current) => ({
      ...current,
      [id]: {
        ...(current[id] || {}),
        ...patch,
      },
    }));
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!canAttemptUpload) {
      e.target.value = '';
      alert(uploadStatusDetail || uploadStatusMessage || 'Upload is unavailable right now.');
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isAllowedMediaFile(file)) {
      setLastUploadNote(REJECTED_FORMATS_MESSAGE);
      alert(REJECTED_FORMATS_MESSAGE);
      e.target.value = '';
      return;
    }

    const mediaType = file.type.startsWith('video/') ? 'video' : 'image';

    setUploading(true);
    setLastUploadNote('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('cover', file);
      fd.append('mediaType', mediaType);
      fd.append('source', 'admin upload');

      let res: any;
      try {
        res = await apiClient.post('/media/upload', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
          // @ts-expect-error custom flag consumed by api.ts interceptor
          skipErrorLog: true,
        });
      } catch (err: any) {
        const status = err?.response?.status;
        const msg = String(err?.response?.data?.message || '').toLowerCase();
        const notFound = status === 404 || msg.includes('route not found');
        if (!notFound) throw err;

        res = await apiClient.post('/uploads/cover', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
          // @ts-expect-error custom flag consumed by api.ts interceptor
          skipErrorLog: true,
        });
      }

      const raw = res?.data;
      const refreshedItems = await fetchMedia({ bustCache: true });
      const indexedInLibrary = didRefreshIncludeUploadedAsset(refreshedItems, raw, file);
      setLastUploadNote(
        indexedInLibrary
          ? `${mediaType === 'video' ? 'Video' : 'Photo'} uploaded and indexed in Media Library.`
          : `${mediaType === 'video' ? 'Video' : 'Photo'} uploaded, but the Media Library list has not returned it yet.`
      );
      alert(`${mediaType === 'video' ? 'Video' : 'Photo'} upload succeeded`);
    } catch (err: any) {
      const parsedMessage = String(
        err?.response?.data?.message
          || err?.response?.data?.error
          || err?.message
          || 'Upload failed'
      );
      console.error('Upload error', {
        primaryRoute: '/admin-api/media/upload',
        fallbackRoute: '/admin-api/uploads/cover',
        status: err?.response?.status ?? null,
        parsedMessage,
        responseBody: err?.response?.data ?? null,
      });
      setLastUploadNote(parsedMessage);
      alert(parsedMessage);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function generateAIAlt(item: MediaItem) {
    try {
      const res = await apiClient.post('/ai/alt-text', { url: item.url }).catch(() => null);
      const alt = safeText(res?.data?.alt) || `Photo of ${item.filename} — auto-generated by AI`;
      updateOverride(item.id, { altText: alt });
    } catch (err) {
      console.error('AI alt generation failed:', err);
    }
  }

  async function scrubEXIF(item: MediaItem) {
    try {
      await apiClient.post('/api/uploads/scrub-exif', { url: item.url }).catch(() => null);
      alert('EXIF scrub requested');
    } catch (err) {
      console.error('EXIF scrub failed:', err);
      alert('EXIF scrub failed');
    }
  }

  async function copyUrl(item: MediaItem) {
    try {
      await navigator.clipboard.writeText(item.url);
      alert('Media URL copied');
    } catch {
      alert('Could not copy URL');
    }
  }

  function openViewer(item: MediaItem) {
    const preview = getPreviewModel(item);
    setViewerItem(item);
    setViewerError(preview.previewUnavailable ? `${preview.errorTitle}. ${preview.errorDetail}` : '');
  }

  function closeViewer() {
    setViewerItem(null);
    setViewerError('');
  }

  function saveMetadata() {
    if (!selectedItem) return;
    updateOverride(selectedItem.id, {
      filename: safeText(draftFilename, selectedItem.filename),
      altText: safeText(draftAltText) || undefined,
      caption: safeText(draftCaption) || undefined,
    });
    alert('Media metadata updated in admin library');
  }

  function requestMoveToTrash(item: MediaItem) {
    setPendingTrashItem(item);
  }

  function confirmMoveToTrash() {
    if (!pendingTrashItem) return;
    const item = pendingTrashItem;
    updateOverride(item.id, { isDeleted: true, deletedAt: new Date().toISOString() });
    if (tab !== 'trash') setSelectedId(item.id);
    setPendingTrashItem(null);
  }

  function restoreFromTrash(item: MediaItem) {
    updateOverride(item.id, { isDeleted: false, deletedAt: undefined });
    setSelectedTrashIds((current) => current.filter((id) => id !== item.id));
  }

  function restoreItems(itemsToRestore: MediaItem[]) {
    if (itemsToRestore.length === 0) return;
    itemsToRestore.forEach((item) => {
      updateOverride(item.id, { isDeleted: false, deletedAt: undefined });
    });
    const restoredIds = new Set(itemsToRestore.map((item) => item.id));
    setSelectedTrashIds((current) => current.filter((id) => !restoredIds.has(id)));
  }

  function toggleArchive(item: MediaItem) {
    updateOverride(item.id, {
      archived: !item.archived,
      hiddenFromFutureSelection: !item.hiddenFromFutureSelection,
    });
  }

  function prepareReplacement(item: MediaItem) {
    if (!replaceTargetId) {
      alert('Select a replacement media item first');
      return;
    }
    updateOverride(item.id, { replaceWithId: replaceTargetId });
    alert('Replacement plan saved. Update linked content before permanent deletion.');
  }

  function permanentlyDelete(item: MediaItem) {
    const isForceDelete = item.usageCount > 0;
    if (isForceDelete && !isFounder) {
      alert('Only founder-level admins can force delete media that is still referenced.');
      return;
    }
    if (isForceDelete && !forceDeleteArmed) {
      alert('Review linked content and arm force delete before continuing.');
      return;
    }
    const confirmation = isForceDelete
      ? 'Force delete this media? Linked content may still reference it until those references are replaced.'
      : 'Delete this media permanently from the library?';
    if (!window.confirm(confirmation)) return;
    updateOverride(item.id, { removed: true });
    setSelectedId(null);
  }

  function requestPermanentDelete(itemsToDelete: MediaItem[]) {
    if (itemsToDelete.length === 0) return;
    setPendingPermanentDeleteItems(itemsToDelete);
  }

  function confirmPermanentDelete() {
    if (!pendingPermanentDeleteItems || pendingPermanentDeleteItems.length === 0) return;
    if (pendingDeleteHasBlockedUsedItems) return;

    const idsToDelete = new Set(pendingPermanentDeleteItems.map((item) => item.id));
    pendingPermanentDeleteItems.forEach((item) => {
      updateOverride(item.id, { removed: true });
    });

    setSelectedTrashIds((current) => current.filter((id) => !idsToDelete.has(id)));
    if (selectedId && idsToDelete.has(selectedId)) {
      setSelectedId(null);
    }
    setPendingPermanentDeleteItems(null);
  }

  function toggleTrashSelection(itemId: string, checked: boolean) {
    setSelectedTrashIds((current) => {
      if (checked) {
        return current.includes(itemId) ? current : [...current, itemId];
      }
      return current.filter((id) => id !== itemId);
    });
  }

  function toggleSelectAllTrash() {
    setSelectedTrashIds((current) => {
      if (allVisibleTrashSelected) {
        const visibleSet = new Set(visibleTrashIds);
        return current.filter((id) => !visibleSet.has(id));
      }
      return Array.from(new Set([...current, ...visibleTrashIds]));
    });
  }

  function clearTrashSelection() {
    setSelectedTrashIds([]);
  }

  function resetFilters() {
    setSearch('');
    setSourceFilter('all');
    setTypeFilter('all');
    setUploadedByFilter('all');
    setUsageFilter('all');
    setStatusFilter(tab === 'trash' ? 'deleted' : 'active');
    setDatePreset('all');
    setFromDate('');
    setToDate('');
  }

  const replacementChoices = mergedItems.filter((item) => !item.isDeleted && item.id !== selectedItem?.id);

  return (
    <div className="space-y-6 pb-8">
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.12),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.12),_transparent_35%),linear-gradient(180deg,_#ffffff,_#f8fafc)] p-6 shadow-sm">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Asset Management</div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">Admin Media Library</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Manage newsroom photos and videos with one upload entry point, date-based organization, safe delete controls, and visibility into where each asset is used.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1">Single entry: Upload Media</span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1">Auto-detects photo vs video</span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1">Trash-first delete lifecycle</span>
            </div>
          </div>

          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <label
              className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-sm ${canAttemptUpload ? 'cursor-pointer bg-slate-900 hover:bg-slate-800' : 'cursor-not-allowed bg-slate-400'}`}
              title={uploadButtonTitle}
            >
              <Upload className="h-4 w-4" />
              {uploading ? 'Uploading…' : 'Upload Media'}
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.mp4,image/jpeg,image/png,video/mp4"
                onChange={handleUpload}
                className="hidden"
                disabled={!canAttemptUpload || uploading}
              />
            </label>
            <button
              type="button"
              onClick={() => void fetchMedia({ bustCache: true })}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-600">
          <span>{uploadStatusLabel}</span>
          {!uploadEnabled && uploadStatusDetail ? <span>{uploadStatusDetail}</span> : null}
          {lastUploadNote ? <span className="rounded-full bg-white px-3 py-1 text-slate-700 shadow-sm">{lastUploadNote}</span> : null}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Active media" value={tabCounts.all} tone="border-slate-200 bg-white" />
        <StatCard label="Photos" value={tabCounts.photos} tone="border-slate-200 bg-white" />
        <StatCard label="Videos" value={tabCounts.videos} tone="border-slate-200 bg-white" />
        <StatCard label="Used assets" value={mergedItems.filter((item) => item.usageCount > 0).length} tone="border-slate-200 bg-white" />
        <StatCard label="Trash" value={tabCounts.trash} tone="border-rose-200 bg-rose-50/80" />
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {([
                { key: 'all', label: 'All Media', count: tabCounts.all },
                { key: 'photos', label: 'Photos', count: tabCounts.photos },
                { key: 'videos', label: 'Videos', count: tabCounts.videos },
                { key: 'trash', label: 'Trash', count: tabCounts.trash },
              ] as Array<{ key: MediaTab; label: string; count: number }>).map((entry) => {
                const active = tab === entry.key;
                return (
                  <button
                    key={entry.key}
                    type="button"
                    onClick={() => {
                      setTab(entry.key);
                      setStatusFilter(entry.key === 'trash' ? 'deleted' : 'active');
                    }}
                    className={`rounded-full px-4 py-2 text-sm font-medium ${active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                  >
                    {entry.label}
                    <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${active ? 'bg-white/15 text-white' : 'bg-white text-slate-600'}`}>{entry.count}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-2">
              {([
                { key: 'grid', label: 'Grid view', icon: Grid2X2 },
                { key: 'list', label: 'List view', icon: List },
                { key: 'timeline', label: 'Timeline view', icon: CalendarDays },
              ] as Array<{ key: ViewMode; label: string; icon: React.ComponentType<{ className?: string }> }>).map((entry) => {
                const Icon = entry.icon;
                const active = viewMode === entry.key;
                return (
                  <button
                    key={entry.key}
                    type="button"
                    onClick={() => setViewMode(entry.key)}
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm ${active ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                  >
                    <Icon className="h-4 w-4" />
                    {entry.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="border-b border-slate-200 px-4 py-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
            <label className="flex min-w-0 flex-col gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
              Search
              <span className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Name, URL, source, linked content"
                  className="w-full bg-transparent text-sm font-normal text-slate-800 outline-none"
                />
              </span>
            </label>

            <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
              Type
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as 'all' | MediaType)} className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800">
                <option value="all">All types</option>
                <option value="image">Photos</option>
                <option value="video">Videos</option>
              </select>
            </label>

            <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
              Source
              <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as 'all' | MediaSource)} className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800">
                <option value="all">All sources</option>
                {SOURCE_OPTIONS.map((source) => <option key={source} value={source}>{source}</option>)}
              </select>
            </label>

            <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
              Uploaded by
              <select value={uploadedByFilter} onChange={(e) => setUploadedByFilter(e.target.value)} className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800">
                <option value="all">Anyone</option>
                {uploadedByOptions.map((person) => <option key={person} value={person}>{person}</option>)}
              </select>
            </label>

            <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
              Usage
              <select value={usageFilter} onChange={(e) => setUsageFilter(e.target.value as UsageFilter)} className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800">
                <option value="all">Used and unused</option>
                <option value="used">Used</option>
                <option value="unused">Unused</option>
              </select>
            </label>

            <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
              Status
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800">
                <option value="all">Active and deleted</option>
                <option value="active">Active</option>
                <option value="deleted">Deleted</option>
              </select>
            </label>

            <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
              Date filter
              <select value={datePreset} onChange={(e) => setDatePreset(e.target.value as DatePreset)} className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800">
                <option value="all">All dates</option>
                <option value="today">Today</option>
                <option value="this-week">This Week</option>
                <option value="this-month">This Month</option>
                <option value="this-year">This Year</option>
                <option value="custom">Custom Date Range</option>
              </select>
            </label>
          </div>

          <div className="mt-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <CalendarDays className="h-4 w-4" />
                Calendar filters
              </div>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setDatePreset('custom');
                  setFromDate(e.target.value);
                }}
                className="rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-800"
              />
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setDatePreset('custom');
                  setToDate(e.target.value);
                }}
                className="rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-800"
              />
            </div>

            <button type="button" onClick={resetFilters} className="text-sm font-medium text-slate-600 hover:text-slate-900">Reset filters</button>
          </div>

          {isTrashManagementView ? (
            <div className="mt-4 rounded-3xl border border-rose-200 bg-rose-50/80 p-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">Trash management</div>
                  <div className="mt-1 text-sm text-rose-900">Select deleted assets to restore them or permanently remove them.</div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={toggleSelectAllTrash} className="rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100">
                    {allVisibleTrashSelected ? 'Deselect All' : 'Select All'}
                  </button>
                  <button type="button" onClick={clearTrashSelection} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                    Clear Selection
                  </button>
                  <span className="rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700">
                    {selectedTrashIds.length} selected
                  </span>
                </div>
              </div>

              {selectedTrashIds.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => restoreItems(selectedTrashItems)} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                    <RotateCcw className="h-4 w-4" />
                    Restore Selected
                  </button>
                  <button type="button" onClick={() => requestPermanentDelete(selectedTrashItems)} className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700">
                    <Trash2 className="h-4 w-4" />
                    Delete Selected Permanently
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="border-b border-slate-200 p-4 xl:border-b-0 xl:border-r">
            {loading ? (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-10 text-center text-sm text-slate-500">Loading media…</div>
            ) : visibleItems.length === 0 ? (
              <EmptyState title="No media matches these filters" detail="Try a different tab, date range, or upload a new photo or video." />
            ) : viewMode === 'grid' ? (
              <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                {visibleItems.map((item) => (
                  <article key={item.id} className={`overflow-hidden rounded-3xl border bg-white shadow-sm transition ${selectedId === item.id ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200 hover:border-slate-300'}`}>
                    <button type="button" onClick={() => setSelectedId(item.id)} className="block w-full text-left">
                      <div className="relative h-52 overflow-hidden bg-slate-100">
                        <PreviewTile item={item} />
                        <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm">
                          {item.mediaType === 'video' ? <Video className="h-3.5 w-3.5" /> : <ImageIcon className="h-3.5 w-3.5" />}
                          {getMediaTypeLabel(item.mediaType)}
                        </div>
                        {item.isDeleted ? (
                          <div className="absolute right-3 top-3 flex items-center gap-2">
                            {isTrashManagementView ? (
                              <label className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/95 shadow-sm" onClick={(event) => event.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={selectedTrashIds.includes(item.id)}
                                  onChange={(event) => toggleTrashSelection(item.id, event.target.checked)}
                                  className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                                  aria-label={`Select ${item.filename}`}
                                />
                              </label>
                            ) : null}
                            <div className="rounded-full bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white">Trash</div>
                          </div>
                        ) : item.archived ? (
                          <div className="absolute right-3 top-3 rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white">Archived</div>
                        ) : null}
                      </div>
                    </button>

                    <div className="space-y-3 p-4">
                      <div>
                        <div className="truncate text-sm font-semibold text-slate-900" title={item.filename}>{item.filename}</div>
                        <div className="mt-1 text-xs text-slate-500">{formatDateTime(item.uploadedAt)}</div>
                      </div>

                      <div className="flex flex-wrap gap-2 text-[11px]">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 ${SOURCE_STYLES[item.source]}`}>{item.source}</span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-600">{formatFileSize(item.fileSize)}</span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-600">Used {item.usageCount}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                        <div>Uploaded by</div>
                        <div className="text-right font-medium text-slate-800">{item.uploadedBy}</div>
                        <div>Source</div>
                        <div className="text-right font-medium text-slate-800">{item.source}</div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => openViewer(item)} className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </button>
                        <button type="button" onClick={() => void copyUrl(item)} className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                          <Copy className="h-3.5 w-3.5" />
                          Copy URL
                        </button>
                        {item.isDeleted && isTrashManagementView ? (
                          <>
                            <button type="button" onClick={() => restoreFromTrash(item)} className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                              <RotateCcw className="h-3.5 w-3.5" />
                              Restore
                            </button>
                            <button type="button" onClick={() => requestPermanentDelete([item])} className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700">
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete Permanently
                            </button>
                          </>
                        ) : !item.isDeleted ? (
                          <button
                            type="button"
                            onClick={() => requestMoveToTrash(item)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-700 transition hover:bg-rose-100"
                            title="Move to Trash"
                            aria-label={`Move ${item.filename} to Trash`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                        <button type="button" onClick={() => setSelectedId(item.id)} className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800">
                          <Pencil className="h-3.5 w-3.5" />
                          Manage
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : viewMode === 'list' ? (
              <div className="overflow-hidden rounded-3xl border border-slate-200">
                <div className="grid grid-cols-[92px_minmax(0,1.3fr)_0.8fr_0.8fr_0.8fr_0.8fr_0.7fr_220px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  <div>Thumbnail</div>
                  <div>File</div>
                  <div>Type</div>
                  <div>Uploaded</div>
                  <div>Uploaded by</div>
                  <div>Source</div>
                  <div>Usage</div>
                  <div>Actions</div>
                </div>
                <div className="divide-y divide-slate-200 bg-white">
                  {visibleItems.map((item) => (
                    <div key={item.id} className={`grid grid-cols-[92px_minmax(0,1.3fr)_0.8fr_0.8fr_0.8fr_0.8fr_0.7fr_220px] gap-3 px-4 py-3 ${selectedId === item.id ? 'bg-slate-50' : ''}`}>
                      <button type="button" onClick={() => setSelectedId(item.id)} className="h-16 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 text-left">
                        <PreviewTile item={item} />
                      </button>
                      <div className="min-w-0">
                        <button type="button" onClick={() => setSelectedId(item.id)} className="truncate text-left text-sm font-semibold text-slate-900 hover:text-slate-700">{item.filename}</button>
                        <div className="mt-1 truncate text-xs text-slate-500">{item.url}</div>
                        <div className="mt-1 text-xs text-slate-500">{formatFileSize(item.fileSize)}</div>
                      </div>
                      <div className="text-sm text-slate-700">{getMediaTypeLabel(item.mediaType)}</div>
                      <div className="text-sm text-slate-700">{formatDateTime(item.uploadedAt)}</div>
                      <div className="text-sm text-slate-700">{item.uploadedBy}</div>
                      <div><span className={`inline-flex rounded-full border px-2 py-1 text-xs ${SOURCE_STYLES[item.source]}`}>{item.source}</span></div>
                      <div className="text-sm text-slate-700">{item.usageCount}</div>
                      <div className="flex flex-wrap gap-2">
                        {item.isDeleted && isTrashManagementView ? (
                          <label className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-700">
                            <input
                              type="checkbox"
                              checked={selectedTrashIds.includes(item.id)}
                              onChange={(event) => toggleTrashSelection(item.id, event.target.checked)}
                              className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                              aria-label={`Select ${item.filename}`}
                            />
                          </label>
                        ) : null}
                        <button type="button" onClick={() => openViewer(item)} className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">View</button>
                        <button type="button" onClick={() => void copyUrl(item)} className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Copy URL</button>
                        {item.isDeleted && isTrashManagementView ? (
                          <>
                            <button type="button" onClick={() => restoreFromTrash(item)} className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Restore</button>
                            <button type="button" onClick={() => requestPermanentDelete([item])} className="rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-700">Delete Permanently</button>
                          </>
                        ) : !item.isDeleted ? (
                          <button
                            type="button"
                            onClick={() => requestMoveToTrash(item)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-700 transition hover:bg-rose-100"
                            title="Move to Trash"
                            aria-label={`Move ${item.filename} to Trash`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                        <button type="button" onClick={() => setSelectedId(item.id)} className="rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white hover:bg-slate-800">Actions</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {timelineGroups.map((year) => (
                  <section key={year.key} className="rounded-3xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 px-5 py-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Year</div>
                      <div className="mt-1 text-xl font-semibold text-slate-900">{year.label}</div>
                    </div>
                    <div className="space-y-5 p-5">
                      {year.months.map((month) => (
                        <div key={month.key} className="space-y-4">
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Month</div>
                            <div className="mt-1 text-lg font-semibold text-slate-900">{month.label}</div>
                          </div>
                          {month.days.map((day) => (
                            <div key={day.key} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Day</div>
                              <div className="mt-1 text-sm font-semibold text-slate-900">{day.label}</div>
                              <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                                {day.items.map((item) => (
                                  <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                                    <div className="flex items-start gap-3">
                                      <button type="button" onClick={() => setSelectedId(item.id)} className="h-16 w-16 overflow-hidden rounded-2xl bg-slate-100 text-left">
                                        <PreviewTile item={item} />
                                      </button>
                                      <div className="min-w-0 flex-1">
                                        <button type="button" onClick={() => setSelectedId(item.id)} className="truncate text-left text-sm font-semibold text-slate-900 hover:text-slate-700">{item.filename}</button>
                                        <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-500">
                                          <span>{getMediaTypeLabel(item.mediaType)}</span>
                                          <span>•</span>
                                          <span>{item.uploadedBy}</span>
                                          <span>•</span>
                                          <span>Used {item.usageCount}</span>
                                        </div>
                                      </div>
                                      {item.isDeleted && isTrashManagementView ? (
                                        <label className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-700">
                                          <input
                                            type="checkbox"
                                            checked={selectedTrashIds.includes(item.id)}
                                            onChange={(event) => toggleTrashSelection(item.id, event.target.checked)}
                                            className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                                            aria-label={`Select ${item.filename}`}
                                          />
                                        </label>
                                      ) : null}
                                    </div>

                                    <div className="mt-3 flex flex-wrap gap-2">
                                      <button type="button" onClick={() => openViewer(item)} className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">View</button>
                                      <button type="button" onClick={() => void copyUrl(item)} className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Copy URL</button>
                                      {item.isDeleted && isTrashManagementView ? (
                                        <>
                                          <button type="button" onClick={() => restoreFromTrash(item)} className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Restore</button>
                                          <button type="button" onClick={() => requestPermanentDelete([item])} className="rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-700">Delete Permanently</button>
                                        </>
                                      ) : null}
                                    </div>
                                  </article>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>

          <aside className="p-4">
            {selectedItem ? (
              <div className="sticky top-4 space-y-4">
                <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                  <div className="relative h-56 bg-slate-100">
                    <PreviewTile item={selectedItem} />
                    <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm">
                      {selectedItem.mediaType === 'video' ? <Video className="h-3.5 w-3.5" /> : <ImageIcon className="h-3.5 w-3.5" />}
                      {getMediaTypeLabel(selectedItem.mediaType)}
                    </div>
                  </div>

                  <div className="space-y-4 p-4">
                    <div>
                      <div className="text-lg font-semibold text-slate-900">{selectedItem.filename}</div>
                      <div className="mt-1 text-xs text-slate-500">{formatDateTime(selectedItem.uploadedAt)}</div>
                    </div>

                    <div className="grid gap-2 text-sm text-slate-700">
                      <div className="flex items-center justify-between gap-4"><span>Source</span><span className={`inline-flex rounded-full border px-2 py-1 text-xs ${SOURCE_STYLES[selectedItem.source]}`}>{selectedItem.source}</span></div>
                      <div className="flex items-center justify-between gap-4"><span>Uploaded by</span><span className="font-medium text-slate-900">{selectedItem.uploadedBy}</span></div>
                      <div className="flex items-center justify-between gap-4"><span>File size</span><span className="font-medium text-slate-900">{formatFileSize(selectedItem.fileSize)}</span></div>
                      <div className="flex items-center justify-between gap-4"><span>Usage count</span><span className="font-medium text-slate-900">{selectedItem.usageCount}</span></div>
                      <div className="flex items-center justify-between gap-4"><span>Status</span><span className="font-medium text-slate-900">{selectedItem.isDeleted ? 'In Trash' : selectedItem.archived ? 'Archived / hidden' : 'Active'}</span></div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => openViewer(selectedItem)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                        <Eye className="h-4 w-4" />
                        View
                      </button>
                      <button type="button" onClick={() => void copyUrl(selectedItem)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                        <Copy className="h-4 w-4" />
                        Copy URL
                      </button>
                      <button type="button" onClick={() => void generateAIAlt(selectedItem)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                        <Sparkles className="h-4 w-4" />
                        AI Alt
                      </button>
                      <button type="button" onClick={() => void scrubEXIF(selectedItem)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                        <ScanSearch className="h-4 w-4" />
                        Scrub EXIF
                      </button>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-sm font-semibold text-slate-900">Metadata</div>
                  <div className="mt-4 space-y-3">
                    <label className="block">
                      <div className="mb-1 text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">File name</div>
                      <input value={draftFilename} onChange={(e) => setDraftFilename(e.target.value)} className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-800" />
                    </label>
                    <label className="block">
                      <div className="mb-1 text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Alt text</div>
                      <textarea value={draftAltText} onChange={(e) => setDraftAltText(e.target.value)} rows={3} className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-800" />
                    </label>
                    <label className="block">
                      <div className="mb-1 text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Caption</div>
                      <textarea value={draftCaption} onChange={(e) => setDraftCaption(e.target.value)} rows={3} className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-800" />
                    </label>
                    <button type="button" onClick={saveMetadata} className="w-full rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">Save metadata</button>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-900">Safe delete & usage</div>
                    <button type="button" onClick={toggleArchive.bind(null, selectedItem)} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                      <Archive className="h-3.5 w-3.5" />
                      {selectedItem.archived ? 'Unarchive' : 'Archive / Hide'}
                    </button>
                  </div>

                  {selectedItem.usageCount > 0 ? (
                    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        <div>
                          <div className="font-semibold">This asset is already used in published or draft content.</div>
                          <div className="mt-1 text-xs leading-5 text-amber-800">
                            Permanent deletion stays blocked by default. Review linked content, replace references, or archive this media so it is hidden from future selection without silently breaking live stories.
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Linked content</div>
                      <button type="button" onClick={() => setSelectedId(selectedItem.id)} className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900">
                        <Link2 className="h-3.5 w-3.5" />
                        See where used
                      </button>
                    </div>
                    <div className="mt-3 space-y-2">
                      {selectedItem.linkedContent.length === 0 ? (
                        <div className="text-sm text-slate-500">No linked articles, stories, or pages are currently tracked for this asset.</div>
                      ) : selectedItem.linkedContent.map((entry) => (
                        <div key={`${entry.kind}-${entry.id}`} className="rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                          <div className="font-medium text-slate-900">{entry.title}</div>
                          <div className="mt-1 text-xs text-slate-500">{formatKindLabel(entry.kind)}{entry.status ? ` • ${entry.status}` : ''}{entry.path ? ` • ${entry.path}` : ''}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {selectedItem.usageCount > 0 ? (
                    <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-white p-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Replace media in linked content</div>
                        <div className="mt-1 text-sm text-slate-600">Select another asset to prepare a replacement workflow before deletion.</div>
                      </div>
                      <select value={replaceTargetId} onChange={(e) => setReplaceTargetId(e.target.value)} className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-800">
                        <option value="">Choose replacement media</option>
                        {replacementChoices.map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>{candidate.filename} • {formatFileSize(candidate.fileSize)}</option>
                        ))}
                      </select>
                      <button type="button" onClick={() => prepareReplacement(selectedItem)} className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Prepare replacement</button>
                      {selectedItem.replaceWithId ? (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                          Replacement target recorded. Remove or update references before permanent deletion.
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="mt-4 grid gap-2">
                    {!selectedItem.isDeleted ? (
                      <button type="button" onClick={() => requestMoveToTrash(selectedItem)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-100">
                        <Trash2 className="h-4 w-4" />
                        Move to Trash
                      </button>
                    ) : (
                      <>
                        <button type="button" onClick={() => restoreFromTrash(selectedItem)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                          <RotateCcw className="h-4 w-4" />
                          Restore
                        </button>

                        {selectedItem.usageCount > 0 && isFounder ? (
                          <label className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
                            <input type="checkbox" checked={forceDeleteArmed} onChange={(e) => setForceDeleteArmed(e.target.checked)} className="mt-1" />
                            <span>
                              Founder-only force delete. Use only after reviewing linked content. This does not update live stories automatically.
                            </span>
                          </label>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => requestPermanentDelete([selectedItem])}
                          disabled={!canPermanentlyDeleteSelected}
                          className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold ${canPermanentlyDeleteSelected ? 'bg-rose-600 text-white hover:bg-rose-700' : 'cursor-not-allowed bg-slate-200 text-slate-500'}`}
                        >
                          <Trash2 className="h-4 w-4" />
                          {selectedItem.usageCount > 0 ? 'Force Delete Permanently' : 'Delete Permanently'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="sticky top-4 rounded-3xl border border-dashed border-slate-300 bg-slate-50/80 p-6 text-sm text-slate-600">
                <div className="text-base font-semibold text-slate-900">Select a media item</div>
                <div className="mt-2 leading-6">
                  Use the grid, list, or timeline to open an asset. The side panel lets you rename, edit alt text and caption, copy URLs, inspect usage, archive safely, and move items through Trash before permanent deletion.
                </div>
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-500">
                  High-authority action: founder-level admins can explicitly force delete referenced media only after reviewing linked content.
                </div>
              </div>
            )}
          </aside>
        </div>
      </section>

      {viewerItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm" onClick={closeViewer}>
          <div className="relative w-full max-w-5xl overflow-hidden rounded-[28px] border border-slate-800 bg-slate-950 text-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4">
              <div className="min-w-0">
                <div className="truncate text-lg font-semibold">{viewerItem.filename}</div>
                <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                  {viewerItem.mediaType === 'video' ? 'Video player' : 'Image preview'}
                </div>
              </div>
              <button type="button" onClick={closeViewer} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 text-slate-300 hover:bg-slate-900 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              {viewerError ? (
                <div className="flex min-h-[340px] flex-col items-center justify-center rounded-3xl border border-slate-800 bg-slate-900 px-6 text-center">
                  <div className="text-lg font-semibold">Preview unavailable</div>
                  <div className="mt-2 max-w-lg text-sm text-slate-300">{viewerError}</div>
                </div>
              ) : viewerItem.mediaType === 'video' ? (
                <video
                  src={getPreviewModel(viewerItem).fullUrl}
                  poster={getPreviewModel(viewerItem).posterUrl || undefined}
                  controls
                  playsInline
                  preload="metadata"
                  autoPlay
                  className="max-h-[72vh] w-full rounded-3xl bg-black"
                  onError={() => setViewerError('Preview unavailable. Asset may be incomplete or corrupted.')}
                />
              ) : (
                <img
                  src={getPreviewModel(viewerItem).fullUrl}
                  alt={viewerItem.altText || viewerItem.filename}
                  className="max-h-[72vh] w-full rounded-3xl bg-slate-950 object-contain"
                  onError={() => setViewerError('Preview unavailable. Asset may be incomplete or corrupted.')}
                />
              )}

              <div className="flex flex-wrap items-center justify-end gap-2 text-sm text-slate-300">
                <div className="flex gap-2">
                  <button type="button" onClick={() => void copyUrl(viewerItem)} className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-900">
                    <Copy className="h-4 w-4" />
                    Copy URL
                  </button>
                  {getPreviewModel(viewerItem).fullUrl ? (
                    <button type="button" onClick={() => window.open(getPreviewModel(viewerItem).fullUrl, '_blank', 'noopener,noreferrer')} className="inline-flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100">
                      <Eye className="h-4 w-4" />
                      Open in new tab
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {pendingTrashItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" onClick={() => setPendingTrashItem(null)}>
          <div className="w-full max-w-lg rounded-[28px] border border-slate-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-600">Move to Trash</div>
                <div className="mt-1 text-xl font-semibold text-slate-900">Review media before trashing</div>
              </div>
              <button type="button" onClick={() => setPendingTrashItem(null)} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900">{pendingTrashItem.filename}</div>
                <div className="mt-3 grid gap-2 text-sm text-slate-700">
                  <div className="flex items-center justify-between gap-4"><span>Media type</span><span className="font-medium text-slate-900">{getMediaTypeLabel(pendingTrashItem.mediaType)}</span></div>
                  <div className="flex items-center justify-between gap-4"><span>File size</span><span className="font-medium text-slate-900">{formatFileSize(pendingTrashItem.fileSize)}</span></div>
                  <div className="flex items-center justify-between gap-4"><span>Usage count</span><span className="font-medium text-slate-900">{pendingTrashItem.usageCount}</span></div>
                </div>
              </div>

              {pendingTrashItem.usageCount > 0 ? (
                <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <div className="font-semibold">This asset is currently used in content.</div>
                      <div className="mt-1 text-xs leading-5 text-amber-800">
                        Moving it to Trash will hide it from active library views, but it may still be referenced by existing stories or pages until those references are updated.
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  This media is not currently tracked as used. It will be moved to Trash and can still be restored later.
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setPendingTrashItem(null)} className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  Cancel
                </button>
                <button type="button" onClick={confirmMoveToTrash} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700">
                  <Trash2 className="h-4 w-4" />
                  Move to Trash
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {pendingPermanentDeleteItems ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm" onClick={() => setPendingPermanentDeleteItems(null)}>
          <div className="w-full max-w-lg rounded-[28px] border border-rose-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-rose-100 px-5 py-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-600">Permanent delete</div>
                <div className="mt-1 text-xl font-semibold text-slate-900">Confirm destructive action</div>
              </div>
              <button type="button" onClick={() => setPendingPermanentDeleteItems(null)} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              {pendingPermanentDeleteItems.length === 1 ? (
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900">{pendingPermanentDeleteItems[0].filename}</div>
                  <div className="mt-3 grid gap-2 text-sm text-slate-700">
                    <div className="flex items-center justify-between gap-4"><span>Media type</span><span className="font-medium text-slate-900">{getMediaTypeLabel(pendingPermanentDeleteItems[0].mediaType)}</span></div>
                    <div className="flex items-center justify-between gap-4"><span>File size</span><span className="font-medium text-slate-900">{formatFileSize(pendingPermanentDeleteItems[0].fileSize)}</span></div>
                  </div>
                </div>
              ) : (
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  <div className="font-semibold text-slate-900">{pendingPermanentDeleteItems.length} media items selected</div>
                  <div className="mt-1">Bulk delete will permanently remove all selected media from Trash.</div>
                </div>
              )}

              <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
                <div className="font-semibold">This action permanently removes the media and cannot be undone.</div>
                {pendingDeleteHasBlockedUsedItems ? (
                  <div className="mt-2 text-xs leading-5 text-rose-800">
                    One or more selected items are still tracked as used. Founder-level access is required to permanently delete referenced media.
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setPendingPermanentDeleteItems(null)} className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  Cancel
                </button>
                <button type="button" onClick={confirmPermanentDelete} disabled={pendingDeleteHasBlockedUsedItems} className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold ${pendingDeleteHasBlockedUsedItems ? 'cursor-not-allowed bg-slate-200 text-slate-500' : 'bg-rose-600 text-white hover:bg-rose-700'}`}>
                  <Trash2 className="h-4 w-4" />
                  {pendingPermanentDeleteItems.length === 1 ? 'Delete Permanently' : 'Delete Selected Permanently'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
