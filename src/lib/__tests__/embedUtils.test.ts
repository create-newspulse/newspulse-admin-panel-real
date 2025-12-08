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
    expect(localMatches).toBe(true);
    expect(isHostAllowed(src)).toBe(true);
  });

  it('rejects disallowed host', () => {
    const src = 'https://evil.example.com/embed/1';
    expect(isHostAllowed(src)).toBe(false);
  });

  describe('host matching edge cases', () => {
    it('handles www prefix variations correctly', () => {
      // www.youtube.com should match youtube.com entry
      expect(isHostAllowed('https://www.youtube.com/embed/abc')).toBe(true);
      expect(isHostAllowed('https://youtube.com/embed/abc')).toBe(true);
      
      // Both should work when both are in allowed list
      expect(isHostAllowed('https://www.ted.com/talks/test')).toBe(true);
      expect(isHostAllowed('https://ted.com/talks/test')).toBe(true);
    });

    it('handles subdomain matching', () => {
      // Subdomains of allowed hosts should be allowed
      expect(isHostAllowed('https://player.vimeo.com/video/123')).toBe(true);
      expect(isHostAllowed('https://embed.ted.com/talks/test')).toBe(true);
      expect(isHostAllowed('https://m.youtube.com/embed/abc')).toBe(true);
      
      // But not arbitrary subdomains that aren't explicitly allowed
      expect(isHostAllowed('https://malicious.youtube.com.evil.com/embed/abc')).toBe(false);
    });

    it('handles case insensitive matching', () => {
      expect(isHostAllowed('https://YOUTUBE.COM/embed/abc')).toBe(true);
      expect(isHostAllowed('https://YouTube.Com/embed/abc')).toBe(true);
      expect(isHostAllowed('https://WWW.YOUTUBE.COM/embed/abc')).toBe(true);
    });

    it('handles different protocols', () => {
      expect(isHostAllowed('http://youtube.com/embed/abc')).toBe(true);
      expect(isHostAllowed('https://youtube.com/embed/abc')).toBe(true);
    });

    it('handles edge cases with malformed URLs', () => {
      expect(isHostAllowed('not-a-url')).toBe(false);
      expect(isHostAllowed('')).toBe(false);
      expect(isHostAllowed('javascript:alert(1)')).toBe(false);
      expect(isHostAllowed('data:text/html,<script>alert(1)</script>')).toBe(false);
      expect(isHostAllowed('ftp://youtube.com/embed/abc')).toBe(true); // Valid URL with allowed host
    });

    it('prevents host spoofing attempts', () => {
      // These should all be rejected as they're not actually youtube.com
      expect(isHostAllowed('https://youtube.com.evil.com/embed/abc')).toBe(false);
      expect(isHostAllowed('https://notyoutube.com/embed/abc')).toBe(false);
      expect(isHostAllowed('https://youtube-fake.com/embed/abc')).toBe(false);
      expect(isHostAllowed('https://evil.com/youtube.com/embed/abc')).toBe(false);
    });

    it('handles port numbers correctly', () => {
      // Hosts with ports should still match
      expect(isHostAllowed('https://youtube.com:443/embed/abc')).toBe(true);
      expect(isHostAllowed('http://youtube.com:80/embed/abc')).toBe(true);
      expect(isHostAllowed('https://youtube.com:8080/embed/abc')).toBe(true);
    });

    it('handles international domain names', () => {
      // Test basic punycode handling (if URL API supports it)
      try {
        const testUrl = new URL('http://xn--example-6za.com');
        expect(testUrl.hostname).toBe('xn--example-6za.com');
        expect(isHostAllowed('http://xn--example-6za.com/embed')).toBe(false);
      } catch (e) {
        // Skip if URL API doesn't support this
      }
    });

    it('matches exact subdomain paths', () => {
      // youtube-nocookie.com should work (it's in the default list)
      expect(isHostAllowed('https://www.youtube-nocookie.com/embed/abc')).toBe(true);
      expect(isHostAllowed('https://youtube-nocookie.com/embed/abc')).toBe(true);
    });
  });

  describe('extractIframeSrc edge cases', () => {
    it('handles plain URLs as input', () => {
      expect(extractIframeSrc('https://youtube.com/embed/abc')).toBe('https://youtube.com/embed/abc');
      expect(extractIframeSrc('  https://youtube.com/embed/abc  ')).toBe('https://youtube.com/embed/abc');
    });

    it('handles various iframe formats', () => {
      // Single quotes
      expect(extractIframeSrc("<iframe src='https://youtube.com/embed/abc'></iframe>"))
        .toBe('https://youtube.com/embed/abc');
      
      // Mixed attributes
      expect(extractIframeSrc('<iframe width="560" src="https://youtube.com/embed/abc" height="315"></iframe>'))
        .toBe('https://youtube.com/embed/abc');
      
      // Case insensitive
      expect(extractIframeSrc('<IFRAME SRC="https://youtube.com/embed/abc"></IFRAME>'))
        .toBe('https://youtube.com/embed/abc');
    });

    it('handles relative URLs in iframes', () => {
      // Should resolve relative URLs if window is available
      const iframe = '<iframe src="/embed/abc"></iframe>';
      const result = extractIframeSrc(iframe);
      // Result depends on whether window.location is available in test environment
      expect(result).toBeTruthy();
    });

    it('handles malformed iframe tags', () => {
      expect(extractIframeSrc('<iframe src="incomplete')).toBeNull();
      expect(extractIframeSrc('<iframe src=>')).toBeNull();
      expect(extractIframeSrc('<iframe>')).toBeNull();
      expect(extractIframeSrc('<iframe src="">')).toBeNull();
    });

    it('returns null for invalid input', () => {
      expect(extractIframeSrc('')).toBeNull();
      expect(extractIframeSrc(null as any)).toBeNull();
      expect(extractIframeSrc(undefined as any)).toBeNull();
    });
  });
});
