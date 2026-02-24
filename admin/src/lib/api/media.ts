export type UploadCoverImageResult = {
  url: string;
  publicId?: string;
};

function extractUploadedUrl(raw: any): string {
  const payload = raw?.data && typeof raw.data === 'object' ? raw.data : raw;
  const url =
    payload?.url ||
    payload?.secure_url ||
    payload?.secureUrl ||
    payload?.coverImageUrl ||
    payload?.imageUrl;
  return String(url || '').trim();
}

function extractPublicId(raw: any): string {
  const payload = raw?.data && typeof raw.data === 'object' ? raw.data : raw;
  const pid = payload?.publicId || payload?.public_id;
  return String(pid || '').trim();
}

// Uploads a cover image and returns a remote URL.
// Expected backend contract (via Vercel proxy): POST /admin-api/uploads/cover
export async function uploadCoverImage(file: File): Promise<UploadCoverImageResult> {
  const fd = new FormData();
  // Preferred field name
  fd.append('cover', file);
  // Back-compat
  fd.append('file', file);

  let token: string | null = null;
  try {
    token = localStorage.getItem('np_token');
  } catch {}

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

  if (!resp.ok) {
    const msg = payload?.error || payload?.message || `Upload failed (${resp.status})`;
    throw new Error(String(msg));
  }

  const url = extractUploadedUrl(payload);
  if (!url) throw new Error('Upload succeeded but no URL was returned');
  const publicId = extractPublicId(payload);
  return { url, publicId: publicId || undefined };
}
