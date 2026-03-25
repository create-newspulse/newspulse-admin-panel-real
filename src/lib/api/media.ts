import type { AxiosInstance } from 'axios';
import apiClient, { apiUrl } from '@/lib/api';

export type MediaStatus = {
  uploadEnabled: boolean;
  reason?: string;
  message?: string;
};

const STATUS_CHECK_FAILED_REASON = 'status_check_failed';

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
  const url = apiUrl('/media/status');
  try {
    const res = await client.get(url, {
      // @ts-expect-error custom flag consumed by our axios interceptor (safe no-op for other clients)
      skipErrorLog: true,
    });
    const raw = res?.data as any;

    // If this accidentally hits the SPA rewrite, Vercel/Vite can return index.html as a string.
    // Treat that as a failed status check (unknown availability).
    if (typeof raw === 'string') {
      const s = raw.trim();
      const looksHtml = s.startsWith('<!doctype') || s.startsWith('<html') || /<head[\s>]/i.test(s);
      if (looksHtml) {
        if (import.meta.env.DEV) {
          try { console.warn('[media] /media/status returned HTML (likely rewrite), treating as status check failure', { url }); } catch {}
        }
        return { uploadEnabled: false, reason: STATUS_CHECK_FAILED_REASON, message: 'Could not verify upload service' };
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

    // If backend explicitly reports enabled/disabled, trust it.
    if (hasExplicitFlag) return { uploadEnabled: !!enabled, reason, message };

    // If backend returns an unexpected shape, do NOT probe upload routes.
    // Probing (OPTIONS) can succeed even when the provider is misconfigured, causing confusing UI.
    if (import.meta.env.DEV) {
      try { console.warn('[media] Unexpected /media/status shape, treating as status check failure', { url, raw }); } catch {}
    }
    return { uploadEnabled: false, reason: STATUS_CHECK_FAILED_REASON, message: 'Could not verify upload service' };
  } catch (err: any) {
    // If endpoint is missing or backend errors, treat as disabled.
    const status = err?.response?.status;
    if (import.meta.env.DEV) {
      try {
        // eslint-disable-next-line no-console
        console.warn('[media] Status check failed', {
          url,
          status,
          message: err?.response?.data?.message || err?.response?.data?.error || err?.message,
        });
      } catch {}
    }

    if (status === 404) {
      return { uploadEnabled: false, reason: STATUS_CHECK_FAILED_REASON, message: 'Status endpoint not found' };
    }
    const rawMsg =
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      err?.message ||
      '';
    const msg = String(rawMsg || '').trim();
    // Network/auth errors => safest is disabled.
    return {
      uploadEnabled: false,
      ...(msg
        ? { reason: STATUS_CHECK_FAILED_REASON, message: msg }
        : { reason: STATUS_CHECK_FAILED_REASON, message: 'Could not verify upload service' }),
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
