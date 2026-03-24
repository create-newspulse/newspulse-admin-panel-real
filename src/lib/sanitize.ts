// Small sanitize wrapper using DOMPurify when available in the browser.
// This file deliberately does not import DOMPurify at top-level to avoid SSR issues.

export function sanitizeHtml(html: string): string {
  if (!html) return '';
  try {
    if (typeof window !== 'undefined') {
      const isDev = Boolean((import.meta as any)?.env?.DEV);
      // Try to require DOMPurify if present
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const DOMPurify = (window as any).DOMPurify || (typeof require !== 'undefined' ? require('dompurify') : null);
      if (DOMPurify && typeof DOMPurify.sanitize === 'function') {
        // Hardened options: allow only a short list of safe tags, limited attributes,
        // block inline styles and event handlers so it's CSP-friendly.
        const config = {
          ALLOWED_TAGS: ['iframe','a','p','div','span','br','strong','em','ul','ol','li','img'],
          ALLOWED_ATTR: ['href','src','alt','title','width','height','allow','allowfullscreen','frameborder'],
          FORCE_BODY: true,
          RETURN_DOM: false,
          // Disallow data-* attributes to prevent exfiltration vectors
          ADD_ATTR: [],
        };
        const cleaned = DOMPurify.sanitize(html, config);
        // Guardrail: never embed localhost/loopback iframes in non-dev builds.
        // This prevents Chrome from loading a chrome-error://chromewebdata/ error page inside an iframe
        // and emitting “Unsafe attempt to load URL http://localhost:5173/ ...” console errors.
        return isDev ? cleaned : stripLoopbackIframes(cleaned);
      }
    }
  } catch (e) {
    // fall through to naive sanitization
  }

  // Fallback: strip script tags and on* attributes (best-effort)
  const fallback = html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
                       .replace(/on[a-z]+\s*=\s*(['"]).*?\1/gi, '')
                       .replace(/javascript:\s*/gi, '');
  const isDev = Boolean((import.meta as any)?.env?.DEV);
  return isDev ? fallback : stripLoopbackIframes(fallback);
}

function stripLoopbackIframes(html: string): string {
  if (!html) return '';
  try {
    if (typeof window !== 'undefined' && typeof DOMParser !== 'undefined') {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const iframes = Array.from(doc.querySelectorAll('iframe'));
      for (const f of iframes) {
        const srcRaw = String(f.getAttribute('src') || '').trim();
        if (!srcRaw) continue;
        let u: URL | null = null;
        try {
          u = new URL(srcRaw, window.location.href);
        } catch {
          u = null;
        }
        if (!u) continue;
        const host = u.hostname.toLowerCase();
        if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '[::1]') {
          f.remove();
        }
      }
      return doc.body.innerHTML;
    }
  } catch {
    // ignore; fall back to regex strip below
  }

  // Best-effort regex fallback for environments without DOMParser.
  // Removes any <iframe ...> whose src contains localhost or loopback.
  return html
    .replace(/<iframe\b[^>]*\bsrc=(['"])([^'"]*)\1[^>]*>[\s\S]*?<\/iframe>/gi, (m, _q, src) => {
      const s = String(src || '').toLowerCase();
      return (s.includes('localhost') || s.includes('127.0.0.1') || s.includes('0.0.0.0') || s.includes('[::1]')) ? '' : m;
    })
    .replace(/<iframe\b[^>]*\bsrc=(['"])([^'"]*)\1[^>]*\/>/gi, (m, _q, src) => {
      const s = String(src || '').toLowerCase();
      return (s.includes('localhost') || s.includes('127.0.0.1') || s.includes('0.0.0.0') || s.includes('[::1]')) ? '' : m;
    });
}
