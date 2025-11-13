import { getAllowedHosts } from './embedConfig';

export function extractIframeSrc(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // If the string looks like raw HTML, only attempt to extract from an <iframe>
  const looksLikeHtml = /<[^>]+>/.test(trimmed);
  if (!looksLikeHtml) {
    // Treat as a plain URL only
    try {
      const u = new URL(trimmed);
      return u.toString();
    } catch {
      return null;
    }
  }

  // Extract src from an iframe tag (case-insensitive, supports single/double quotes)
  const m = /<iframe[^>]*\s+src=(["'])(.*?)\1/i.exec(trimmed);
  if (!m || !m[2]) return null;

  try {
    const base = typeof window !== 'undefined' ? window.location.href : undefined;
    const resolved = new URL(m[2], base);
    return resolved.toString();
  } catch {
    // If it's not a resolvable URL, treat as invalid
    return null;
  }
}

export function isHostAllowed(src: string): boolean {
  try {
  // Use a simple, deterministic comparison based on the parsed hostname.
  const hostname = new URL(src).hostname.toLowerCase();
  const hostNoWww = hostname.replace(/^www\./, '');
  const allowed = getAllowedHosts();

  return allowed.some(entry => {
    const e = entry.toLowerCase();
    const eNoWww = e.replace(/^www\./, '');
    return hostname === e || hostNoWww === eNoWww || hostNoWww.endsWith('.' + eNoWww);
  });
  } catch (e) {
    return false;
  }
}
