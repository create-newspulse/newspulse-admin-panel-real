const INSTAGRAM_SHORTCODE_RE = /^[A-Za-z0-9_-]{2,128}$/;
const INSTAGRAM_PATH_TYPE_RE = /^(p|reel|tv)$/;

export type NewsPulseInstagramEmbed = {
  shortcode: string;
  url: string;
  kind: 'p' | 'reel' | 'tv';
};

export function isValidInstagramShortcode(value: unknown): value is string {
  return INSTAGRAM_SHORTCODE_RE.test(String(value || '').trim());
}

function isInstagramPathType(value: string): value is NewsPulseInstagramEmbed['kind'] {
  return INSTAGRAM_PATH_TYPE_RE.test(value);
}

function isSupportedInstagramHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'instagram.com' || host === 'www.instagram.com';
}

export function parseNewsPulseInstagramUrl(raw: unknown): NewsPulseInstagramEmbed | null {
  const value = String(raw || '').trim();
  if (!value) return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:') return null;
  if (!isSupportedInstagramHost(url.hostname)) return null;

  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length !== 2) return null;

  const [kind, shortcode] = parts;
  if (!isInstagramPathType(kind)) return null;
  if (!isValidInstagramShortcode(shortcode)) return null;

  return {
    shortcode,
    url: `https://www.instagram.com/${kind}/${shortcode}/`,
    kind,
  };
}

export function parseNewsPulseInstagramAttrs(attrs: { shortcode?: unknown; url?: unknown }): NewsPulseInstagramEmbed | null {
  const shortcode = String(attrs.shortcode || '').trim();
  const fromUrl = parseNewsPulseInstagramUrl(attrs.url);
  if (!fromUrl) return null;
  if (shortcode && shortcode !== fromUrl.shortcode) return null;
  return fromUrl;
}

export function extractNewsPulseInstagramFromHtml(rawHtml: unknown): NewsPulseInstagramEmbed | null {
  const html = String(rawHtml || '');
  if (!/<\s*blockquote\b[^>]*instagram-media/i.test(html) && !/instagram\.com\/embed\.js/i.test(html)) return null;

  try {
    if (typeof DOMParser !== 'undefined') {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const candidates = Array.from(doc.querySelectorAll('[href], [data-instgrm-permalink]'));
      for (const candidate of candidates) {
        const parsed = parseNewsPulseInstagramUrl(candidate.getAttribute('href') || candidate.getAttribute('data-instgrm-permalink'));
        if (parsed) return parsed;
      }
      return null;
    }
  } catch {
    // Fall through to the regex fallback.
  }

  const hrefMatches = html.matchAll(/\b(?:href|data-instgrm-permalink)=(['"])([^'"]+)\1/gi);
  for (const match of hrefMatches) {
    const parsed = parseNewsPulseInstagramUrl(match[2]);
    if (parsed) return parsed;
  }
  return null;
}