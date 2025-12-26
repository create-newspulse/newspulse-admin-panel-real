export const COVER_IMAGE_MAX_BYTES = 2 * 1024 * 1024; // 2MB

const ALLOWED_IMAGE_EXT = ['jpg', 'jpeg', 'png', 'webp'] as const;
const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type ImageUrlValidation = {
  ok: boolean;
  error?: string;
  warning?: string;
};

export function validateImageUrl(input: string): ImageUrlValidation {
  const url = (input || '').trim();
  if (!url) return { ok: true };

  if (!/^https?:\/\//i.test(url)) {
    return { ok: false, error: 'Image URL must start with http:// or https://.' };
  }

  try {
    // eslint-disable-next-line no-new
    new URL(url);
  } catch {
    return { ok: false, error: 'Image URL is not a valid URL.' };
  }

  // Extension heuristics: allow any valid URL but warn if unknown
  const lower = url.toLowerCase();
  const hasKnownExt = ALLOWED_IMAGE_EXT.some((ext) => {
    // tolerate query strings
    return lower.includes(`.${ext}`);
  });

  if (!hasKnownExt) {
    return {
      ok: true,
      warning: 'URL does not look like a common image file (jpg/png/webp). It may still work.',
    };
  }

  return { ok: true };
}

export type ImageFileValidation = {
  ok: boolean;
  error?: string;
};

export function validateImageFile(file: File, opts?: { maxBytes?: number }): ImageFileValidation {
  const maxBytes = typeof opts?.maxBytes === 'number' ? opts.maxBytes : COVER_IMAGE_MAX_BYTES;

  if (!file) return { ok: false, error: 'No file selected.' };

  if (file.size > maxBytes) {
    const mb = (maxBytes / (1024 * 1024)).toFixed(0);
    return { ok: false, error: `Image must be ≤ ${mb}MB.` };
  }

  const mimeOk = ALLOWED_IMAGE_MIME.includes(file.type as any);
  const nameOk = (() => {
    const lower = (file.name || '').toLowerCase();
    return ALLOWED_IMAGE_EXT.some((ext) => lower.endsWith(`.${ext}`));
  })();

  if (!mimeOk && !nameOk) {
    return { ok: false, error: 'Allowed formats: jpg, jpeg, png, webp.' };
  }

  return { ok: true };
}
