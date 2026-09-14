import type { AxiosInstance } from 'axios';
import apiClient, { apiUrl } from '@/lib/api';
import { adminFetch } from '@/lib/http/adminFetch';

export type MediaStatus = {
  uploadEnabled: boolean;
  reason?: string;
  message?: string;
  detail?: string;
  provider?: string;
};

function shouldDebugMediaStatus(): boolean {
  if (!import.meta.env.DEV) return false;
  try {
    if (typeof window !== 'undefined' && (window as any).__np_debug_media_status) return true;
  } catch {}
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('np_debug_media_status') === '1') return true;
  } catch {}
  return false;
}

function devDebug(msg: string, extra?: any) {
  if (!shouldDebugMediaStatus()) return;
  try {
    // eslint-disable-next-line no-console
    console.log(msg, extra);
  } catch {}
}

export type UploadCoverImageResult = {
  url: string;
  publicId?: string;
  width?: number;
  height?: number;
  bytes?: number;
  format?: string;
};

export type UploadInlineImageResult = {
  mediaId: string;
  url: string;
  alt?: string;
  caption?: string;
  credit?: string;
  width?: number;
  height?: number;
  bytes?: number;
  format?: string;
  mimeType?: string;
  size?: number;
  provider?: string;
};

export type UploadVideoFileResult = {
  url: string;
  filename?: string;
  bytes?: number;
  mimetype?: string;
};

function normalizeVideoUploadErrorMessage(raw: unknown): string {
  const message = String(raw || '').trim();
  if (!message) return 'Video upload failed';

  if (/\b(jpg|jpeg|png|webp|thumbnail|image)\b/i.test(message)) {
    return 'Only MP4, WebM, or MOV videos are allowed.';
  }

  return message;
}

function isUploadVideoRouteFallbackMessage(message: string, status: number): boolean {
  if (status === 404 || status === 405) return true;
  return /cloud video upload is available but disabled|use video url unless enabled|route not found|not found/i.test(message);
}

function extractUploadedNumber(raw: any, key: string): number | undefined {
  const payload = raw?.data && typeof raw.data === 'object' ? raw.data : raw;
  const value = payload?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function extractUploadedString(raw: any, key: string): string | undefined {
  const payload = raw?.data && typeof raw.data === 'object' ? raw.data : raw;
  const value = payload?.[key];
  const normalized = String(value || '').trim();
  return normalized || undefined;
}

function extractUploadedUrlFromPayload(raw: any): string {
  const root = raw?.data && typeof raw.data === 'object' ? raw.data : raw;
  const url =
    root?.url ||
    root?.secureUrl ||
    root?.secure_url ||
    root?.inlineImageUrl ||
    root?.inline_image_url ||
    root?.coverImageUrl ||
    root?.imageUrl ||
    root?.location ||
    root?.media?.url ||
    root?.asset?.url ||
    root?.image?.url ||
    root?.item?.url ||
    root?.file?.url;
  return String(url || '').trim();
}

function extractUploadedPublicIdFromPayload(raw: any): string {
  const root = raw?.data && typeof raw.data === 'object' ? raw.data : raw;
  const pid =
    root?.mediaId ||
    root?.media_id ||
    root?.publicId ||
    root?.public_id ||
    root?._id ||
    root?.id ||
    root?.media?._id ||
    root?.media?.id ||
    root?.media?.publicId ||
    root?.asset?._id ||
    root?.asset?.id ||
    root?.asset?.publicId ||
    root?.image?._id ||
    root?.image?.id ||
    root?.image?.publicId ||
    root?.file?._id ||
    root?.file?.id;
  return String(pid || '').trim();
}

function extractUploadedNestedString(raw: any, key: string): string | undefined {
  const root = raw?.data && typeof raw.data === 'object' ? raw.data : raw;
  const candidates = [root?.[key], root?.media?.[key], root?.asset?.[key], root?.image?.[key], root?.file?.[key]];
  for (const candidate of candidates) {
    const normalized = String(candidate || '').trim();
    if (normalized) return normalized;
  }
  return undefined;
}

function extractUploadedNestedNumber(raw: any, key: string): number | undefined {
  const root = raw?.data && typeof raw.data === 'object' ? raw.data : raw;
  const candidates = [root?.[key], root?.media?.[key], root?.asset?.[key], root?.image?.[key], root?.file?.[key]];
  for (const candidate of candidates) {
    const parsed = Number(candidate);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

export async function getMediaStatus(client: AxiosInstance = apiClient): Promise<MediaStatus> {
  const reqUrl = apiUrl('/media/status');
  try {
    devDebug('[media] fetching status', { url: reqUrl });

    const res = await client.get(reqUrl, {
      // @ts-expect-error custom flag consumed by our axios interceptor (safe no-op for other clients)
      skipErrorLog: true,
    });
    const raw = res?.data as any;
    devDebug('[media] raw status response', raw);

    // Defensive: if a rewrite returns HTML/string instead of JSON, treat as unavailable.
    if (typeof raw === 'string') {
      const s = raw.trim();
      const looksHtml = s.startsWith('<!doctype') || s.startsWith('<html') || /<head[\s>]/i.test(s);
      if (looksHtml) {
        devDebug('[media] /media/status returned HTML (likely rewrite)');
        return {
          uploadEnabled: false,
          reason: 'media_status_endpoint_unavailable',
          message: 'Media status endpoint unavailable',
          detail: 'Could not verify upload service',
        };
      }
    }

    // Accept common shapes:
    // - { uploadEnabled: true }
    // - { ok: true, uploadEnabled: true }
    // - { data: { uploadEnabled: true } }
    // - { uploads: { enabled: true } }
    const payload = raw?.data && typeof raw.data === 'object' ? raw.data : raw;

    // Newer contract supported by backend:
    // { ok:true, provider:'cloudinary', available:true, configured:true, reason:null, message:'...' }
    const ok = typeof payload?.ok === 'boolean' ? payload.ok : undefined;
    const available = typeof payload?.available === 'boolean' ? payload.available : undefined;
    const configured = typeof payload?.configured === 'boolean' ? payload.configured : undefined;

    const legacyFlags: Array<unknown> = [
      payload?.uploadEnabled,
      payload?.uploads?.enabled,
      payload?.storage?.uploadEnabled,
      payload?.storage?.enabled,
    ];
    const hasLegacyExplicitFlag = legacyFlags.some((v) => typeof v === 'boolean');

    const legacyEnabled =
      payload?.uploadEnabled === true ||
      payload?.uploads?.enabled === true ||
      payload?.storage?.uploadEnabled === true ||
      payload?.storage?.enabled === true;

    const reason = typeof payload?.reason === 'string' && payload.reason.trim() ? payload.reason : undefined;
    const message =
      (typeof payload?.message === 'string' && payload.message.trim())
        ? payload.message
        : (typeof payload?.error === 'string' && payload.error.trim())
          ? payload.error
          : undefined;

    const detail =
      (typeof payload?.detail === 'string' && payload.detail.trim())
        ? payload.detail
        : undefined;

    const provider = typeof payload?.provider === 'string' ? payload.provider : undefined;

    // Prefer new contract when present.
    const hasNewContract = typeof ok === 'boolean' && typeof available === 'boolean' && typeof configured === 'boolean';
    if (hasNewContract) {
      const uploadEnabled = ok === true && available === true && configured === true;
      const normalizedReason = reason || (!configured ? 'cloudinary_not_configured' : undefined);
      const normalized: MediaStatus = { uploadEnabled, reason: normalizedReason, message, detail, provider };
      devDebug('[media] normalized status (new contract)', normalized);
      return normalized;
    }

    // If backend explicitly reports enabled/disabled via legacy flags, trust it.
    if (hasLegacyExplicitFlag) {
      const normalized: MediaStatus = { uploadEnabled: !!legacyEnabled, reason, message, detail, provider };
      devDebug('[media] normalized status (legacy flags)', normalized);
      return normalized;
    }

    // If backend returns an unexpected shape, do NOT probe upload routes.
    // Probing (OPTIONS) can succeed even when the provider is misconfigured, causing confusing UI.
    devDebug('[media] Unexpected /media/status response shape', { raw });
    return {
      uploadEnabled: false,
      reason: 'media_status_endpoint_unavailable',
      message: 'Media status endpoint unavailable',
      detail: 'Could not verify upload service',
    };
  } catch (err: any) {
    // If endpoint is missing or backend errors, treat as disabled.
    const status = err?.response?.status;
    const rawMsg =
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      err?.message ||
      '';
    const msg = String(rawMsg || '').trim();

    devDebug('[media] /media/status request failed', { url: reqUrl, status, message: msg || undefined });

    if (status === 404) {
      return {
        uploadEnabled: false,
        reason: 'media_status_endpoint_unavailable',
        message: 'Media status endpoint unavailable',
        detail: 'Backend does not expose /api/media/status',
      };
    }
    // Network/auth errors => safest is disabled.
    return {
      uploadEnabled: false,
      reason: 'media_status_request_failed',
      message: msg || 'Status check failed',
    };
  }
}

function extractUploadedUrl(raw: any): string {
  const payload = raw?.data && typeof raw.data === 'object' ? raw.data : raw;
  const coverObj = payload?.coverImage && typeof payload.coverImage === 'object' ? payload.coverImage : null;
  const url =
    coverObj?.url ||
    coverObj?.secureUrl ||
    coverObj?.secure_url ||
    extractUploadedUrlFromPayload(payload);
  return String(url || '').trim();
}

function extractUploadedPublicId(raw: any): string {
  const payload = raw?.data && typeof raw.data === 'object' ? raw.data : raw;
  const coverObj = payload?.coverImage && typeof payload.coverImage === 'object' ? payload.coverImage : null;
  const pid =
    payload?.publicId ||
    payload?.public_id ||
    coverObj?.publicId ||
    coverObj?.public_id ||
    coverObj?.id ||
    extractUploadedPublicIdFromPayload(payload);
  return String(pid || '').trim();
}

// Upload a cover image and return a usable remote URL.
// Supports multiple backend contracts:
// - POST /api/media/upload   (frontend path: /media/upload)
// - POST /api/uploads/cover  (frontend path: /uploads/cover)
export async function uploadCoverImage(file: File, client: AxiosInstance = apiClient): Promise<UploadCoverImageResult> {
  // Client param kept for compatibility; cover upload uses the proxy contract explicitly.
  void client;

  const fd = new FormData();
  // Required admin contract field name
  fd.append('cover', file);

  let token: string | null = null;
  try {
    token = localStorage.getItem('np_token');
  } catch {}

  // NOTE: When using FormData, the browser automatically sends multipart/form-data
  // with the correct boundary. Do not manually set the boundary header.
  const resp = await fetch('/admin-api/uploads/cover', {
    method: 'POST',
    body: fd,
    credentials: 'include',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  let payload: any = null;
  try {
    payload = await resp.json();
  } catch {
    payload = null;
  }

  if (!resp.ok || payload?.ok === false) {
    const msg =
      payload?.error ||
      payload?.message ||
      payload?.data?.error ||
      payload?.data?.message ||
      `Upload failed (${resp.status})`;
    throw new Error(String(msg));
  }

  // Expected: { ok:true, data:{ url, publicId } }
  const data = payload?.data && typeof payload.data === 'object' ? payload.data : payload;
  const url = extractUploadedUrl(data);
  if (!url) throw new Error('Upload succeeded but no URL was returned');
  const publicId = extractUploadedPublicId(data);
  const result: UploadCoverImageResult = {
    url,
    publicId: publicId || undefined,
    width: extractUploadedNumber(data, 'width'),
    height: extractUploadedNumber(data, 'height'),
    bytes: extractUploadedNumber(data, 'bytes'),
    format: extractUploadedString(data, 'format'),
  };
  devDebug('[media] upload cover success', result);
  return result;
}

const INLINE_ARTICLE_IMAGE_UPLOAD_PATH = '/admin/articles/media/image';

function isAllowedInlineImageFile(file: File): boolean {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
}

function isTemporaryImageUrl(url: string): boolean {
  return /^(blob:|data:)/i.test(url.trim());
}

async function postInlineImageFile(file: File): Promise<UploadInlineImageResult> {
  const fd = new FormData();
  fd.append('image', file);

  const resp = await adminFetch(INLINE_ARTICLE_IMAGE_UPLOAD_PATH, {
    method: 'POST',
    body: fd,
  });

  let payload: any = null;
  try {
    payload = await resp.json();
  } catch {
    payload = null;
  }

  if (!resp.ok || payload?.ok === false) {
    const msg =
      payload?.error ||
      payload?.message ||
      payload?.data?.error ||
      payload?.data?.message ||
      `Inline image upload failed (${resp.status})`;
    const error = new Error(String(msg));
    (error as any).status = resp.status;
    (error as any).uploadUrl = INLINE_ARTICLE_IMAGE_UPLOAD_PATH;
    throw error;
  }

  const data = payload?.data && typeof payload.data === 'object' ? payload.data : payload;
  const uploadedUrl = extractUploadedUrlFromPayload(data);
  if (!uploadedUrl) throw new Error('Inline image upload succeeded but no URL was returned');
  if (isTemporaryImageUrl(uploadedUrl)) throw new Error('Inline image upload returned a temporary URL');

  const mediaId = extractUploadedPublicIdFromPayload(data);
  if (!mediaId) throw new Error('Inline image upload succeeded but no media id was returned');

  const mimeType = extractUploadedNestedString(data, 'mimeType');
  const size = extractUploadedNestedNumber(data, 'size');

  return {
    mediaId,
    url: uploadedUrl,
    alt: extractUploadedNestedString(data, 'alt') || extractUploadedNestedString(data, 'altText'),
    caption: extractUploadedNestedString(data, 'caption'),
    credit: extractUploadedNestedString(data, 'credit') || extractUploadedNestedString(data, 'source'),
    width: extractUploadedNestedNumber(data, 'width'),
    height: extractUploadedNestedNumber(data, 'height'),
    bytes: extractUploadedNestedNumber(data, 'bytes') || size,
    format: extractUploadedNestedString(data, 'format') || mimeType,
    mimeType,
    size,
    provider: extractUploadedNestedString(data, 'provider'),
  };
}

export async function uploadInlineImage(file: File): Promise<UploadInlineImageResult> {
  if (!isAllowedInlineImageFile(file)) {
    throw new Error('Only JPEG, PNG, or WebP images can be uploaded inline.');
  }

  return postInlineImageFile(file);
}

async function postViralVideoFile(file: File, url: string): Promise<UploadVideoFileResult> {
  const fd = new FormData();
  fd.append('video', file);

  let token: string | null = null;
  try {
    token = localStorage.getItem('np_token');
  } catch {}

  const resp = await fetch(url, {
    method: 'POST',
    body: fd,
    credentials: 'include',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  let payload: any = null;
  try {
    payload = await resp.json();
  } catch {
    payload = null;
  }

  if (!resp.ok || payload?.ok === false) {
    const msg =
      payload?.error ||
      payload?.message ||
      payload?.data?.error ||
      payload?.data?.message ||
      `Video upload failed (${resp.status})`;
    const error = new Error(normalizeVideoUploadErrorMessage(msg));
    (error as any).status = resp.status;
    (error as any).uploadUrl = url;
    throw error;
  }

  const data = payload?.data && typeof payload.data === 'object' ? payload.data : payload;
  const uploadedUrl = String(data?.url || payload?.url || '').trim();
  if (!uploadedUrl) throw new Error('Video upload succeeded but no URL was returned');

  return {
    url: uploadedUrl,
    filename: String(data?.filename || payload?.filename || '').trim() || undefined,
    bytes: extractUploadedNumber(data, 'bytes'),
    mimetype: extractUploadedString(data, 'mimetype'),
  };
}

export async function uploadVideoFile(file: File): Promise<UploadVideoFileResult> {
  try {
    return await postViralVideoFile(file, '/admin-api/admin/viral-videos/upload-video');
  } catch (error: any) {
    const message = String(error?.message || '').trim();
    const status = Number(error?.status || 0);
    if (isUploadVideoRouteFallbackMessage(message, status)) {
      return await postViralVideoFile(file, '/admin-api/admin/viral-videos/upload');
    }
    throw error;
  }
}
