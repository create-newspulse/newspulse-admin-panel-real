import { describe, it, expect } from 'vitest';
import { extractIframeSrc, isHostAllowed } from '../embedUtils';
import { getAllowedHosts } from '../embedConfig';

describe('embedUtils', () => {
  it('extracts iframe src', () => {
    const html = '<iframe src="https://www.youtube.com/embed/abc123" width="560"></iframe>';
    const src = extractIframeSrc(html);
    expect(src).toContain('youtube.com/embed/abc123');
  });

  it('returns null for no iframe', () => {
    expect(extractIframeSrc('<div>no iframe</div>')).toBeNull();
  });

  it('validates allowed host', () => {
    const src = 'https://www.youtube.com/embed/abc123';
    // allowed by default list
    const parsedHost = new URL(src).hostname.toLowerCase();
    const allowed = getAllowedHosts().map(h => h.toLowerCase());
    const hostNoWww = parsedHost.replace(/^www\./, '');
    const localMatches = allowed.some(entry => {
      const eNoWww = entry.replace(/^www\./, '');
      return parsedHost === entry || hostNoWww === eNoWww || hostNoWww.endsWith('.' + eNoWww);
    });
    // eslint-disable-next-line no-console
    console.log('TEST DIAG parsedHost=', parsedHost, 'allowed=', allowed, 'localMatches=', localMatches, 'isHostAllowed=', isHostAllowed(src));
    expect(localMatches).toBe(true);
    expect(isHostAllowed(src)).toBe(true);
  });

  it('rejects disallowed host', () => {
    const src = 'https://evil.example.com/embed/1';
    expect(isHostAllowed(src)).toBe(false);
  });
});
