import type { AxiosInstance } from 'axios';
import apiClient from '@/lib/api';

export type MediaStatus = {
  uploadEnabled: boolean;
  reason?: string;
  message?: string;
  detail?: string;
  provider?: string;
};

let didWarnMediaStatusFailure = false;

function devWarnOnce(msg: string, extra?: any) {
  if (!import.meta.env.DEV) return;
  if (didWarnMediaStatusFailure) return;
  didWarnMediaStatusFailure = true;
  try {
    // eslint-disable-next-line no-console
    console.warn(msg, extra);
  } catch {}
}

export type UploadCoverImageResult = {
  url: string;
  publicId?: string;
};

function extractUploadedUrlFromPayload(raw: any): string {
  const root = raw?.data && typeof raw.data === 'object' ? raw.data : raw;
  const url =
    root?.url ||
    root?.secureUrl ||
    root?.secure_url ||
    root?.coverImageUrl ||
    root?.imageUrl ||
    root?.location ||
    root?.item?.url ||
    root?.file?.url;
  return String(url || '').trim();
}

function extractUploadedPublicIdFromPayload(raw: any): string {
  const root = raw?.data && typeof raw.data === 'object' ? raw.data : raw;
  const pid = root?.publicId || root?.public_id || root?.id;
  return String(pid || '').trim();
}

export async function getMediaStatus(client: AxiosInstance = apiClient): Promise<MediaStatus> {
  try {
    const res = await client.get('/media/status', {
      // @ts-expect-error custom flag consumed by our axios interceptor (safe no-op for other clients)
      skipErrorLog: true,
    });
    const raw = res?.data as any;

    // Defensive: if a rewrite returns HTML/string instead of JSON, treat as unavailable.
    if (typeof raw === 'string') {
      const s = raw.trim();
      const looksHtml = s.startsWith('<!doctype') || s.startsWith('<html') || /<head[\s>]/i.test(s);
      if (looksHtml) {
        devWarnOnce('[media] /media/status returned HTML (likely rewrite), treating as endpoint unavailable');
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

    const explicitFlags: Array<unknown> = [
      payload?.uploadEnabled,
      payload?.uploads?.enabled,
      payload?.storage?.uploadEnabled,
      payload?.storage?.enabled,
    ];
    const hasExplicitFlag = explicitFlags.some((v) => typeof v === 'boolean');

    const enabled =
      payload?.uploadEnabled === true ||
      payload?.uploads?.enabled === true ||
      payload?.storage?.uploadEnabled === true ||
      payload?.storage?.enabled === true;

    const reason = typeof payload?.reason === 'string' ? payload.reason : undefined;
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

    // If backend explicitly reports enabled/disabled, trust it.
    if (hasExplicitFlag) return { uploadEnabled: !!enabled, reason, message, detail, provider };

    // If backend returns an unexpected shape, do NOT probe upload routes.
    // Probing (OPTIONS) can succeed even when the provider is misconfigured, causing confusing UI.
    devWarnOnce('[media] Unexpected /media/status response shape, treating as endpoint unavailable', { raw });
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

    devWarnOnce('[media] /media/status request failed', { status, message: msg || undefined });

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
  return { url, publicId: publicId || undefined };
}
