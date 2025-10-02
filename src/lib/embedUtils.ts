import { getAllowedHosts } from './embedConfig';

export function extractIframeSrc(input: string): string | null {
  if (!input) return null;
  // If input is a plain URL
  try {
    const maybeUrl = new URL(input.trim(), window?.location?.href || undefined);
    if (maybeUrl && maybeUrl.hostname) return maybeUrl.toString();
  } catch (e) {
    // not a plain url
  }

  const m = /<iframe[^>]+src=["']([^"']+)["']/i.exec(input);
  if (m && m[1]) {
    try {
      const resolved = new URL(m[1], window?.location?.href || undefined);
      return resolved.toString();
    } catch (e) {
      return m[1];
    }
  }
  return null;
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
