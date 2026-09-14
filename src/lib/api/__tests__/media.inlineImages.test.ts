import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const CANONICAL_INLINE_IMAGE_URL = '/admin-api/admin/articles/media/image';
const OLD_GUESSED_INLINE_IMAGE_URLS = [
  '/admin-api/uploads/inline-image',
  '/admin-api/uploads/inline',
  '/admin-api/media/inline-image',
  '/admin-api/media/inline-upload',
];

function imageFile(): File {
  return new File([new Uint8Array([1, 2, 3])], 'inline.webp', { type: 'image/webp' });
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function loadSubject(response: Response) {
  vi.resetModules();
  localStorage.setItem('admin_token', 'admin-token');
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  const mod = await import('@/lib/api/media');
  return { uploadInlineImage: mod.uploadInlineImage, fetchMock };
}

function expectSingleCanonicalRequest(fetchMock: ReturnType<typeof vi.fn>): RequestInit {
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe(CANONICAL_INLINE_IMAGE_URL);
  expect(OLD_GUESSED_INLINE_IMAGE_URLS).not.toContain(url);
  return init;
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  localStorage.clear();
});

describe('inline article image upload API contract', () => {
  it('uploads to the canonical Phase 1A endpoint and maps the permanent media response', async () => {
    const { uploadInlineImage, fetchMock } = await loadSubject(jsonResponse(200, {
      ok: true,
      data: {
        mediaId: 'media-123',
        url: 'https://cdn.newspulse.co.in/articles/inline/media-123.webp',
        width: 1280,
        height: 720,
        mimeType: 'image/webp',
        size: 34567,
        provider: 'cloudinary',
        source: 'article-inline',
      },
    }));

    const file = imageFile();
    const result = await uploadInlineImage(file);

    expect(result).toMatchObject({
      mediaId: 'media-123',
      url: 'https://cdn.newspulse.co.in/articles/inline/media-123.webp',
      width: 1280,
      height: 720,
      mimeType: 'image/webp',
      size: 34567,
      provider: 'cloudinary',
      bytes: 34567,
      format: 'image/webp',
      source: 'article-inline',
    });
    expect(result.credit).toBeUndefined();
    expect(result.caption).toBeUndefined();
    expect(result.alt).toBeUndefined();
    const init = expectSingleCanonicalRequest(fetchMock);
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get('image')).toBe(file);
    expect(init.headers).toBeInstanceOf(Headers);
    expect((init.headers as Headers).get('Authorization')).toBe('Bearer admin-token');
    expect((init.headers as Headers).has('Content-Type')).toBe(false);
  });

  it.each([
    [401, 'Unauthorized'],
    [403, 'Forbidden'],
  ])('surfaces backend auth status %s without fallback probing', async (status, message) => {
    const { uploadInlineImage, fetchMock } = await loadSubject(jsonResponse(status, { message }));

    await expect(uploadInlineImage(imageFile())).rejects.toThrow(message);

    expectSingleCanonicalRequest(fetchMock);
  });

  it('surfaces backend validation errors without fallback probing', async () => {
    const { uploadInlineImage, fetchMock } = await loadSubject(jsonResponse(400, {
      error: 'Only JPEG, PNG, or WebP images are allowed.',
    }));

    await expect(uploadInlineImage(imageFile())).rejects.toThrow('Only JPEG, PNG, or WebP images are allowed.');

    expectSingleCanonicalRequest(fetchMock);
  });

  it('surfaces backend 500 errors without fallback probing', async () => {
    const { uploadInlineImage, fetchMock } = await loadSubject(jsonResponse(500, {
      error: 'Inline media storage failed',
    }));

    await expect(uploadInlineImage(imageFile())).rejects.toThrow('Inline media storage failed');

    expectSingleCanonicalRequest(fetchMock);
  });

  it('does not guess alternate endpoints after a 404', async () => {
    const { uploadInlineImage, fetchMock } = await loadSubject(jsonResponse(404, {
      error: 'Route not found',
    }));

    await expect(uploadInlineImage(imageFile())).rejects.toThrow('Route not found');

    expectSingleCanonicalRequest(fetchMock);
  });
});