const X_POST_ID_RE = /^\d+$/;
const X_USERNAME_RE = /^[A-Za-z0-9_]{1,15}$/;

export type NewsPulseXEmbed = {
  postId: string;
  url: string;
  username?: string;
};

export function isValidXPostId(value: unknown): value is string {
  return X_POST_ID_RE.test(String(value || '').trim());
}

function isSupportedXHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'x.com'
    || host === 'www.x.com'
    || host === 'twitter.com'
    || host === 'www.twitter.com';
}

export function parseNewsPulseXUrl(raw: unknown): NewsPulseXEmbed | null {
  const value = String(raw || '').trim();
  if (!value) return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:') return null;
  if (!isSupportedXHost(url.hostname)) return null;

  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length !== 3 || parts[1].toLowerCase() !== 'status') return null;

  const [username, _status, postId] = parts;
  if (!X_USERNAME_RE.test(username)) return null;
  if (!isValidXPostId(postId)) return null;

  return {
    postId,
    url: value,
    username,
  };
}

export function parseNewsPulseXAttrs(attrs: { postId?: unknown; url?: unknown }): NewsPulseXEmbed | null {
  const postId = String(attrs.postId || '').trim();
  const fromUrl = parseNewsPulseXUrl(attrs.url);
  if (!fromUrl) return null;
  if (postId && postId !== fromUrl.postId) return null;
  return fromUrl;
}

export function extractNewsPulseXFromHtml(rawHtml: unknown): NewsPulseXEmbed | null {
  const html = String(rawHtml || '');
  if (!/<\s*blockquote\b[^>]*twitter-tweet/i.test(html) && !/platform\.twitter\.com\/widgets\.js/i.test(html)) return null;

  try {
    if (typeof DOMParser !== 'undefined') {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const links = Array.from(doc.querySelectorAll('a[href]'));
      for (const link of links) {
        const parsed = parseNewsPulseXUrl(link.getAttribute('href'));
        if (parsed) return parsed;
      }
      return null;
    }
  } catch {
    // Fall through to the regex fallback.
  }

  const hrefMatches = html.matchAll(/\bhref=(['"])([^'"]+)\1/gi);
  for (const match of hrefMatches) {
    const parsed = parseNewsPulseXUrl(match[2]);
    if (parsed) return parsed;
  }
  return null;
}