import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from '../sanitize';

describe('sanitizeHtml', () => {
  it('removes script tags', () => {
    const input = '<p>Hello</p><script>alert(1)</script>';
    const out = sanitizeHtml(input);
    expect(out).not.toContain('<script>');
    expect(out).toContain('<p>Hello</p>');
  });

  it('strips on* attributes', () => {
    const input = '<img src="x" onerror="alert(1)" />';
    const out = sanitizeHtml(input);
    expect(out.toLowerCase()).not.toContain('onerror');
  });
});
