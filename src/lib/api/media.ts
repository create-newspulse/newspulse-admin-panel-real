import type { AxiosInstance } from 'axios';
import apiClient from '@/lib/api';

const envAny = import.meta.env as any;

function isLocalDemoBackendEnabled(): boolean {
  return String(envAny?.VITE_USE_LOCAL_DEMO_BACKEND || '').toLowerCase() === 'true';
}

export type MediaStatus = {
  uploadEnabled: boolean;
};

export type UploadCoverImageResult = {
  url: string;
  publicId?: string;
};

async function probeUploadRoute(client: AxiosInstance): Promise<boolean> {
  // Support multiple backend contracts:
  // - Newer:  POST /api/media/upload   (frontend path: /media/upload)
  // - Legacy: POST /api/uploads/cover  (frontend path: /uploads/cover)
  const candidates = ['/media/upload', '/uploads/cover'];

  for (const url of candidates) {
    try {
      // OPTIONS is a safe way to detect route existence without uploading a file.
      await client.request({
        url,
        method: 'OPTIONS',
        // @ts-expect-error custom flag consumed by our axios interceptor (safe no-op for other clients)
        skipErrorLog: true,
      });
      return true;
    } catch (err: any) {
      const status = err?.response?.status;
      // 404 => try next candidate
      if (status === 404) continue;
      // Any other HTTP response (401/403/405/etc) implies the route exists.
      if (typeof status === 'number') return true;
      // Network / CORS / no-response => try next, then ultimately disabled
      continue;
    }
  }

  return false;
}

export async function getMediaStatus(client: AxiosInstance = apiClient): Promise<MediaStatus> {
  // Some production backends do not implement media endpoints yet.
  // Avoid triggering a noisy 404 in the browser console by only probing media status
  // when running the local demo backend.
  if (!isLocalDemoBackendEnabled()) return { uploadEnabled: false };

  try {
    const res = await client.get('/media/status', {
      // @ts-expect-error custom flag consumed by our axios interceptor (safe no-op for other clients)
      skipErrorLog: true,
    });
    const raw = res?.data as any;

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

    // If backend explicitly reports enabled/disabled, trust it.
    if (hasExplicitFlag) return { uploadEnabled: !!enabled };

    // Otherwise, treat status response as "unknown" and probe the upload route.
    return { uploadEnabled: await probeUploadRoute(client) };
  } catch (err: any) {
    // If endpoint is missing or backend has no storage configured, treat as disabled.
    const status = err?.response?.status;
    if (status === 404) return { uploadEnabled: await probeUploadRoute(client) };
    // Network/auth errors => safest is disabled.
    return { uploadEnabled: false };
  }
}

function extractUploadedUrl(raw: any): string {
  const payload = raw?.data && typeof raw.data === 'object' ? raw.data : raw;
  const coverObj = payload?.coverImage && typeof payload.coverImage === 'object' ? payload.coverImage : null;
  const url =
    coverObj?.url ||
    coverObj?.secureUrl ||
    coverObj?.secure_url ||
    payload?.url ||
    payload?.coverImageUrl ||
    payload?.imageUrl ||
    payload?.location ||
    payload?.item?.url ||
    payload?.file?.url;
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
    coverObj?.id;
  return String(pid || '').trim();
}

// Upload a cover image and return a usable remote URL.
// Supports multiple backend contracts:
// - POST /api/media/upload   (frontend path: /media/upload)
// - POST /api/uploads/cover  (frontend path: /uploads/cover)
export async function uploadCoverImage(file: File, client: AxiosInstance = apiClient): Promise<UploadCoverImageResult> {
  // Prefer the contract requested by the admin panel:
  // POST /admin-api/uploads/cover  (proxy handles Cloudinary)
  // but keep legacy candidates for local demo backends.
  const candidates = ['/uploads/cover', '/media/upload'];
  let lastErr: any = null;

  for (const url of candidates) {
    const fd = new FormData();
    // Admin contract uses field name: cover
    fd.append('cover', file);
    // Legacy/demo compatibility
    fd.append('file', file);
    try {
      const res = await client.post(url, fd, {
        // Let axios set the correct multipart boundary.
        headers: { 'Content-Type': 'multipart/form-data' },
        // @ts-expect-error custom flag consumed by our axios interceptor (safe no-op for other clients)
        skipErrorLog: true,
      });
      const uploadedUrl = extractUploadedUrl(res?.data);
      if (!uploadedUrl) throw new Error('Upload succeeded but no URL was returned');
      const publicId = extractUploadedPublicId(res?.data);
      return { url: uploadedUrl, publicId: publicId || undefined };
    } catch (err: any) {
      lastErr = err;
      const status = err?.response?.status;
      if (status === 404) continue;
      // For non-404 errors (auth, validation, etc.), stop trying other endpoints.
      throw err;
    }
  }

  throw lastErr || new Error('Upload route not available');
}
