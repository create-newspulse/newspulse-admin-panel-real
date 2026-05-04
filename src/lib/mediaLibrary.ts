import apiClient from '@/lib/api';

export type MediaLibraryAssetType = 'image' | 'video';

export type MediaLibraryAsset = {
  id: string;
  url: string;
  thumbnailUrl: string;
  posterUrl?: string;
  filename: string;
  mediaType: MediaLibraryAssetType;
  mimeType?: string;
  uploadedAt?: string;
  uploadedBy: string;
  source: string;
  fileSize?: number;
  usageCount: number;
  tags: string[];
};

function safeText(value: unknown, fallback = ''): string {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function safeNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isAbsoluteHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function isLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function buildDevAssetUrl(path: string): string {
  return `http://localhost:5000${path.startsWith('/') ? path : `/${path}`}`;
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

  if (primaryText.startsWith('/')) return import.meta.env.DEV ? buildDevAssetUrl(primaryText) : primaryText;
  if (relativeText.startsWith('/')) return import.meta.env.DEV ? buildDevAssetUrl(relativeText) : relativeText;
  return primaryText || relativeText;
}

function extractUploadsItems(raw: any): any[] {
  const candidates = [raw?.items, raw?.data?.items, raw?.data?.data?.items, raw?.data, raw];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

function inferMediaType(input: any): MediaLibraryAssetType {
  const explicit = safeText(input?.mediaType || input?.type || input?.mimeType || input?.mime || input?.contentType).toLowerCase();
  if (explicit.includes('video')) return 'video';
  if (explicit.includes('image') || explicit.includes('photo') || explicit.includes('picture')) return 'image';

  const name = safeText(input?.filename || input?.name || input?.url || input?.path).toLowerCase();
  if (/\.(mp4|mov|m4v|webm|ogg|ogv|avi|mkv)$/.test(name)) return 'video';
  return 'image';
}

function extractUploadedBy(raw: any): string {
  const direct = raw?.uploadedBy || raw?.uploadedByName || raw?.uploaderName || raw?.ownerName || raw?.createdByName || raw?.authorName;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  const objectCandidate = raw?.uploadedByUser || raw?.uploader || raw?.owner || raw?.createdBy || raw?.author;
  if (objectCandidate && typeof objectCandidate === 'object') {
    const label = safeText(objectCandidate.name || objectCandidate.email || objectCandidate.username);
    if (label) return label;
  }
  return safeText(raw?.uploadedByEmail || raw?.uploaderEmail || raw?.ownerEmail || raw?.createdByEmail, 'System');
}

export function formatMediaFileSize(bytes?: number): string {
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

export function formatMediaUploadedDate(value?: string): string {
  const raw = safeText(value);
  if (!raw) return 'Unknown date';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function normalizeMediaLibraryAsset(raw: any): MediaLibraryAsset {
  const mediaType = inferMediaType(raw);
  const relativeUrl = safeText(raw?.relativeUrl || raw?.relativePath || raw?.file?.relativeUrl);
  const url = resolveAssetUrl(raw?.url || raw?.path || raw?.secure_url || raw?.secureUrl || raw?.location, relativeUrl);
  const thumbnailUrl = resolveAssetUrl(raw?.thumbnailUrl || raw?.previewUrl || raw?.poster || raw?.posterUrl, relativeUrl) || url;
  const posterUrl = mediaType === 'video'
    ? (resolveAssetUrl(raw?.poster || raw?.posterUrl || raw?.thumbnailUrl || raw?.previewUrl, relativeUrl) || thumbnailUrl || url)
    : undefined;
  const linked = Array.isArray(raw?.linkedContent) ? raw.linkedContent : [];
  const tags = Array.isArray(raw?.tags) ? raw.tags.map((tag: unknown) => safeText(tag)).filter(Boolean) : [];

  return {
    id: safeText(raw?.id || raw?._id || raw?.publicId || raw?.filename || raw?.url || raw?.name),
    url,
    thumbnailUrl,
    posterUrl,
    filename: safeText(raw?.filename || raw?.name || raw?.originalName || raw?.title || raw?.url, 'Untitled media'),
    mediaType,
    mimeType: safeText(raw?.mimeType || raw?.mime || raw?.contentType) || undefined,
    uploadedAt: safeText(raw?.uploadedAt || raw?.createdAt || raw?.updatedAt || raw?.date) || undefined,
    uploadedBy: extractUploadedBy(raw),
    source: safeText(raw?.source || raw?.uploadSource || raw?.origin || raw?.module || raw?.context, 'other system upload'),
    fileSize: safeNumber(raw?.bytes ?? raw?.size ?? raw?.fileSize),
    usageCount: safeNumber(raw?.usageCount ?? raw?.usedCount ?? raw?.referencesCount ?? raw?.usage?.count) ?? linked.length,
    tags,
  };
}

export async function fetchMediaLibraryAssets(): Promise<MediaLibraryAsset[]> {
  const res = await apiClient.get('/uploads', {
    // @ts-expect-error custom flag consumed by api.ts interceptor
    skipErrorLog: true,
  });
  return extractUploadsItems(res?.data)
    .map((item) => normalizeMediaLibraryAsset(item))
    .filter((item) => item.url);
}
