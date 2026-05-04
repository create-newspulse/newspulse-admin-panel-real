import apiClient from '@/lib/api';

export type MediaLibraryAssetType = 'image' | 'video';

export type MediaLibraryAsset = {
  id: string;
  url: string;
  thumbnailUrl: string;
  posterUrl?: string;
  assetUrl?: string;
  secureUrl?: string;
  previewUrls: string[];
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

const MIN_SELECTOR_VIDEO_BYTES = 100 * 1024;

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

function isLiveBrowser(): boolean {
  try {
    return typeof window !== 'undefined' && window.location?.hostname && !isLoopbackHostname(window.location.hostname);
  } catch {
    return !import.meta.env.DEV;
  }
}

function isPreviewableAbsoluteUrl(value: string): boolean {
  if (!isAbsoluteHttpUrl(value)) return true;
  try {
    const parsed = new URL(value);
    return !(isLiveBrowser() && isLoopbackHostname(parsed.hostname));
  } catch {
    return false;
  }
}

function splitUrlSuffix(value: string) {
  const match = value.match(/^([^?#]*)([?#].*)?$/);
  return {
    base: match?.[1] || value,
    suffix: match?.[2] || '',
  };
}

function replaceAssetExtension(value: string, nextExtension: string): string {
  const { base, suffix } = splitUrlSuffix(value);
  const nextBase = /\.[a-z0-9]+$/i.test(base) ? base.replace(/\.[a-z0-9]+$/i, nextExtension) : `${base}${nextExtension}`;
  return `${nextBase}${suffix}`;
}

function isImageDeliveryUrl(value: string): boolean {
  return /\/(image)\/upload\//i.test(value) || /\.(jpe?g|png|webp|gif|avif)(?:[?#].*)?$/i.test(value);
}

function isVideoDeliveryUrl(value: string): boolean {
  return /\/(video)\/upload\//i.test(value) || /\.(mp4|mov|m4v|webm|ogg|ogv|avi|mkv)(?:[?#].*)?$/i.test(value);
}

function isPlayableVideoUrl(value: string): boolean {
  if (!isPreviewableAbsoluteUrl(value)) return false;
  return isVideoDeliveryUrl(value) || /\/(uploads?|media|videos?)\//i.test(value);
}

function deriveCloudinaryVideoFrameUrls(value: string): string[] {
  const raw = safeText(value);
  if (!raw || !/\/video\/upload\//i.test(raw)) return [];

  const imageUrl = replaceAssetExtension(raw, '.jpg');
  return [
    imageUrl.replace(/\/video\/upload\//i, '/video/upload/so_1,w_640,h_360,c_fill,q_auto,f_jpg/'),
    imageUrl.replace(/\/video\/upload\//i, '/video/upload/so_0,w_640,h_360,c_fill,q_auto,f_jpg/'),
    imageUrl.replace(/\/video\/upload\//i, '/video/upload/w_640,h_360,c_fill,q_auto,f_jpg/'),
  ];
}

function buildDevAssetUrl(path: string): string {
  return `http://localhost:5000${path.startsWith('/') ? path : `/${path}`}`;
}

function buildProxyAssetUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return normalized.startsWith('/admin-api/') ? normalized : `/admin-api${normalized}`;
}

function resolveAssetUrl(primary: unknown, relative?: unknown): string {
  const primaryText = safeText(primary);
  const relativeText = safeText(relative);

  if (primaryText && isAbsoluteHttpUrl(primaryText)) {
    try {
      const parsed = new URL(primaryText);
      if (relativeText.startsWith('/') && isLoopbackHostname(parsed.hostname) && isLiveBrowser()) {
        return buildProxyAssetUrl(relativeText);
      }
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

  if (primaryText.startsWith('/')) return import.meta.env.DEV ? buildDevAssetUrl(primaryText) : buildProxyAssetUrl(primaryText);
  if (relativeText.startsWith('/')) return import.meta.env.DEV ? buildDevAssetUrl(relativeText) : buildProxyAssetUrl(relativeText);
  return primaryText || relativeText;
}

function uniqueUrls(values: unknown[], relativeUrl?: string): string[] {
  const seen = new Set<string>();
  return values
    .map((value) => resolveAssetUrl(value, relativeUrl))
    .filter((value) => {
      if (!value || seen.has(value) || !isPreviewableAbsoluteUrl(value)) return false;
      seen.add(value);
      return true;
    });
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
  const assetUrl = resolveAssetUrl(raw?.assetUrl || raw?.asset_url || raw?.file?.assetUrl || raw?.file?.url, relativeUrl);
  const secureUrl = resolveAssetUrl(raw?.secureUrl || raw?.secure_url || raw?.file?.secureUrl || raw?.file?.secure_url, relativeUrl);
  const playbackUrls = mediaType === 'video'
    ? uniqueUrls([raw?.url, raw?.path, raw?.location, raw?.secureUrl, raw?.secure_url, secureUrl, raw?.assetUrl, raw?.asset_url, assetUrl], relativeUrl).filter(isPlayableVideoUrl)
    : [];
  const url = mediaType === 'video'
    ? (playbackUrls[0] || resolveAssetUrl(raw?.url || raw?.path || secureUrl || raw?.location || assetUrl, relativeUrl))
    : resolveAssetUrl(raw?.url || raw?.path || secureUrl || raw?.location || assetUrl, relativeUrl);
  const thumbnailUrl = resolveAssetUrl(raw?.thumbnailUrl || raw?.previewUrl || raw?.poster || raw?.posterUrl, relativeUrl) || url;
  const posterUrl = mediaType === 'video'
    ? (resolveAssetUrl(raw?.poster || raw?.posterUrl || raw?.thumbnailUrl || raw?.previewUrl, relativeUrl) || thumbnailUrl || url)
    : undefined;
  const previewUrls = mediaType === 'image'
    ? uniqueUrls([raw?.thumbnailUrl, raw?.posterUrl, raw?.poster, raw?.assetUrl, raw?.asset_url, assetUrl, raw?.url, raw?.path, url, raw?.secureUrl, raw?.secure_url, secureUrl, raw?.location], relativeUrl)
    : uniqueUrls([
        raw?.thumbnailUrl,
        raw?.previewUrl,
        raw?.poster,
        raw?.posterUrl,
        posterUrl,
        ...playbackUrls.flatMap((candidate) => deriveCloudinaryVideoFrameUrls(candidate)),
      ], relativeUrl).filter(isImageDeliveryUrl);
  const linked = Array.isArray(raw?.linkedContent) ? raw.linkedContent : [];
  const tags = Array.isArray(raw?.tags) ? raw.tags.map((tag: unknown) => safeText(tag)).filter(Boolean) : [];

  return {
    id: safeText(raw?.id || raw?._id || raw?.publicId || raw?.filename || raw?.url || raw?.name),
    url,
    thumbnailUrl,
    posterUrl,
    assetUrl: assetUrl || undefined,
    secureUrl: secureUrl || undefined,
    previewUrls,
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

export function getMediaLibraryPreviewUrls(asset: MediaLibraryAsset): string[] {
  const candidates = asset.mediaType === 'image'
    ? [asset.thumbnailUrl, asset.posterUrl, asset.assetUrl, asset.url, asset.secureUrl, ...asset.previewUrls]
    : [asset.thumbnailUrl, asset.posterUrl, ...asset.previewUrls];
  const seen = new Set<string>();
  return candidates.filter((value) => {
    const url = safeText(value);
    if (!url || seen.has(url) || !isPreviewableAbsoluteUrl(url)) return false;
    seen.add(url);
    return true;
  });
}

export function getMediaLibraryPlayableVideoUrl(asset: MediaLibraryAsset): string {
  if (asset.mediaType !== 'video') return '';
  const candidates = [asset.url, asset.assetUrl, asset.secureUrl];
  return candidates.find((value) => isPlayableVideoUrl(safeText(value))) || '';
}

export function isValidMediaLibraryImageAsset(asset: MediaLibraryAsset): boolean {
  if (asset.mediaType !== 'image') return false;
  const size = safeNumber(asset.fileSize);
  if (typeof size === 'number' && size < 100) return false;
  return getMediaLibraryPreviewUrls(asset).length > 0;
}

export function isValidMediaLibraryVideoAsset(asset: MediaLibraryAsset): boolean {
  if (asset.mediaType !== 'video') return false;
  const size = safeNumber(asset.fileSize);
  if (typeof size === 'number' && size < MIN_SELECTOR_VIDEO_BYTES) return false;
  return !!getMediaLibraryPlayableVideoUrl(asset);
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
