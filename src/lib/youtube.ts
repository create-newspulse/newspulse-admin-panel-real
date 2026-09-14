import { extractYouTubeVideoId } from '@/types/publicSiteSettings';

const YOUTUBE_VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

export type NewsPulseYouTubeEmbed = {
  videoId: string;
  url: string;
  embedUrl: string;
  thumbnailUrl: string;
};

export function isValidYouTubeVideoId(value: unknown): value is string {
  return YOUTUBE_VIDEO_ID_RE.test(String(value || '').trim());
}

function isSupportedYouTubeHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, '');
  return host === 'youtube.com'
    || host === 'm.youtube.com'
    || host === 'music.youtube.com'
    || host === 'youtu.be'
    || host === 'youtube-nocookie.com';
}

function extractYouTubeNoCookieVideoId(url: URL): string | null {
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (host !== 'youtube-nocookie.com') return null;
  const parts = url.pathname.split('/').filter(Boolean);
  return parts.length >= 2 && parts[0] === 'embed' ? parts[1] : null;
}

export function parseNewsPulseYouTubeUrl(raw: unknown): NewsPulseYouTubeEmbed | null {
  const value = String(raw || '').trim();
  if (!value) return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (!isSupportedYouTubeHost(url.hostname)) return null;

  const videoId = extractYouTubeVideoId(value) || extractYouTubeNoCookieVideoId(url);
  if (!isValidYouTubeVideoId(videoId)) return null;

  return {
    videoId,
    url: value,
    embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  };
}

export function parseNewsPulseYouTubeAttrs(attrs: { videoId?: unknown; url?: unknown }): NewsPulseYouTubeEmbed | null {
  const fromUrl = parseNewsPulseYouTubeUrl(attrs.url);
  if (fromUrl) return fromUrl;

  const videoId = String(attrs.videoId || '').trim();
  if (!isValidYouTubeVideoId(videoId)) return null;

  const url = `https://www.youtube.com/watch?v=${videoId}`;
  return {
    videoId,
    url,
    embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  };
}

export function extractNewsPulseYouTubeFromHtml(rawHtml: unknown): NewsPulseYouTubeEmbed | null {
  const html = String(rawHtml || '');
  if (!/<iframe\b/i.test(html)) return null;

  try {
    if (typeof DOMParser !== 'undefined') {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const src = doc.querySelector('iframe')?.getAttribute('src');
      return src ? parseNewsPulseYouTubeUrl(src) : null;
    }
  } catch {
    // Fall through to the regex fallback.
  }

  const match = html.match(/<iframe\b[^>]*\bsrc=(['"])([^'"]+)\1/i);
  return match?.[2] ? parseNewsPulseYouTubeUrl(match[2]) : null;
}