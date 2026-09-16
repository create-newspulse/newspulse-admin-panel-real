import { getAuthToken } from './api';

const FACEBOOK_SEGMENT_RE = /^[A-Za-z0-9._-]{1,128}$/;
const FACEBOOK_RESERVED_ROOTS = new Set([
  'checkpoint',
  'explore',
  'groups',
  'login',
  'marketplace',
  'photo.php',
  'profile.php',
  'stories',
  'story.php',
  'watch',
]);

export type NewsPulseFacebookEmbed = {
  url: string;
  kind: 'post' | 'reel';
};

export type NewsPulseFacebookShareLink = {
  url: string;
};

export const FACEBOOK_SHARE_REEL_RESOLVE_ERROR = 'Unable to resolve this Facebook share link. Open the post and try copying the direct Facebook link.';

const FACEBOOK_SHARE_REEL_RESOLVER_PATH = '/admin-api/admin/articles/media/facebook/resolve';

function isSupportedFacebookHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'facebook.com' || host === 'www.facebook.com';
}

function decodeSafeSegment(value: string | undefined): string | null {
  if (!value) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(value).trim();
  } catch {
    return null;
  }
  return FACEBOOK_SEGMENT_RE.test(decoded) ? decoded : null;
}

function isReservedRoot(value: string): boolean {
  return FACEBOOK_RESERVED_ROOTS.has(value.toLowerCase());
}

export function parseNewsPulseFacebookShareReelUrl(raw: unknown): NewsPulseFacebookShareLink | null {
  const value = String(raw || '').trim();
  if (!value) return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:') return null;
  if (!isSupportedFacebookHost(url.hostname)) return null;

  const parts = url.pathname.replace(/\/+$/g, '').split('/').filter(Boolean);
  if (parts.length !== 3 || parts[0].toLowerCase() !== 'share' || parts[1].toLowerCase() !== 'r') return null;

  const shareId = decodeSafeSegment(parts[2]);
  if (!shareId) return null;

  return {
    url: `https://www.facebook.com/share/r/${encodeURIComponent(shareId)}/`,
  };
}

export function parseNewsPulseFacebookUrl(raw: unknown): NewsPulseFacebookEmbed | null {
  const value = String(raw || '').trim();
  if (!value) return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:') return null;
  if (!isSupportedFacebookHost(url.hostname)) return null;

  const pathname = url.pathname.replace(/\/+$/g, '');
  if (pathname === '/permalink.php') {
    const storyFbid = decodeSafeSegment(url.searchParams.get('story_fbid') || undefined);
    const id = decodeSafeSegment(url.searchParams.get('id') || undefined);
    if (!storyFbid || !id) return null;
    return {
      url: `https://www.facebook.com/permalink.php?story_fbid=${encodeURIComponent(storyFbid)}&id=${encodeURIComponent(id)}`,
      kind: 'post',
    };
  }

  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 2 && parts[0].toLowerCase() === 'reel') {
    const reelId = decodeSafeSegment(parts[1]);
    if (!reelId) return null;
    return {
      url: `https://www.facebook.com/reel/${encodeURIComponent(reelId)}`,
      kind: 'reel',
    };
  }

  if (parts.length !== 3 || parts[1].toLowerCase() !== 'posts') return null;

  const pageOrUser = decodeSafeSegment(parts[0]);
  const postId = decodeSafeSegment(parts[2]);
  if (!pageOrUser || !postId) return null;
  if (isReservedRoot(pageOrUser)) return null;

  return {
    url: `https://www.facebook.com/${encodeURIComponent(pageOrUser)}/posts/${encodeURIComponent(postId)}`,
    kind: 'post',
  };
}

export function parseNewsPulseFacebookAttrs(attrs: { url?: unknown }): NewsPulseFacebookEmbed | null {
  return parseNewsPulseFacebookUrl(attrs.url);
}

function extractResolvedFacebookUrl(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object') return undefined;
  const body = payload as Record<string, any>;
  return body.url
    || body.resolvedUrl
    || body.canonicalUrl
    || body.data?.url
    || body.data?.resolvedUrl
    || body.data?.canonicalUrl;
}

export async function resolveNewsPulseFacebookShareReelUrl(raw: unknown): Promise<NewsPulseFacebookEmbed | null> {
  const share = parseNewsPulseFacebookShareReelUrl(raw);
  if (!share) return null;

  const headers = new Headers({
    Accept: 'application/json',
    'Content-Type': 'application/json',
  });
  const token = getAuthToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  try {
    const response = await fetch(FACEBOOK_SHARE_REEL_RESOLVER_PATH, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify({ url: share.url }),
    });
    if (!response.ok) return null;
    const payload = await response.json().catch(() => null);
    return parseNewsPulseFacebookUrl(extractResolvedFacebookUrl(payload));
  } catch {
    return null;
  }
}

export async function resolveNewsPulseFacebookInput(raw: unknown): Promise<NewsPulseFacebookEmbed | null> {
  const direct = parseNewsPulseFacebookUrl(raw);
  if (direct) return direct;
  if (!parseNewsPulseFacebookShareReelUrl(raw)) return null;
  return resolveNewsPulseFacebookShareReelUrl(raw);
}

function parseFacebookPluginSrc(raw: unknown): NewsPulseFacebookEmbed | null {
  const value = String(raw || '').trim();
  if (!value) return null;

  let url: URL;
  try {
    url = new URL(value, 'https://www.facebook.com');
  } catch {
    return null;
  }

  if (url.protocol !== 'https:') return null;
  if (!isSupportedFacebookHost(url.hostname)) return null;
  if (url.pathname !== '/plugins/post.php') return null;

  return parseNewsPulseFacebookUrl(url.searchParams.get('href'));
}

export function extractNewsPulseFacebookFromHtml(rawHtml: unknown): NewsPulseFacebookEmbed | null {
  const html = String(rawHtml || '');
  if (!/<\s*iframe\b/i.test(html) && !/<\s*script\b/i.test(html) && !/<\s*div\b[^>]*fb-post/i.test(html)) return null;

  try {
    if (typeof DOMParser !== 'undefined') {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const candidates = Array.from(doc.querySelectorAll('[data-href], [href], iframe[src]'));
      for (const candidate of candidates) {
        const direct = parseNewsPulseFacebookUrl(candidate.getAttribute('data-href') || candidate.getAttribute('href'));
        if (direct) return direct;

        const plugin = parseFacebookPluginSrc(candidate.getAttribute('src'));
        if (plugin) return plugin;
      }
      return null;
    }
  } catch {
    // Fall through to the regex fallback.
  }

  const attrMatches = html.matchAll(/\b(?:data-href|href|src)=(['"])([^'"]+)\1/gi);
  for (const match of attrMatches) {
    const direct = parseNewsPulseFacebookUrl(match[2]);
    if (direct) return direct;

    const plugin = parseFacebookPluginSrc(match[2]);
    if (plugin) return plugin;
  }
  return null;
}