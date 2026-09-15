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
};

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
    };
  }

  const parts = pathname.split('/').filter(Boolean);
  if (parts.length !== 3 || parts[1].toLowerCase() !== 'posts') return null;

  const pageOrUser = decodeSafeSegment(parts[0]);
  const postId = decodeSafeSegment(parts[2]);
  if (!pageOrUser || !postId) return null;
  if (isReservedRoot(pageOrUser)) return null;

  return {
    url: `https://www.facebook.com/${encodeURIComponent(pageOrUser)}/posts/${encodeURIComponent(postId)}`,
  };
}

export function parseNewsPulseFacebookAttrs(attrs: { url?: unknown }): NewsPulseFacebookEmbed | null {
  return parseNewsPulseFacebookUrl(attrs.url);
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