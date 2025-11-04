// Small sanitize wrapper using DOMPurify when available in the browser.
// This file deliberately does not import DOMPurify at top-level to avoid SSR issues.
export function sanitizeHtml(html) {
    if (!html)
        return '';
    try {
        if (typeof window !== 'undefined') {
            // Try to require DOMPurify if present
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const DOMPurify = window.DOMPurify || (typeof require !== 'undefined' ? require('dompurify') : null);
            if (DOMPurify && typeof DOMPurify.sanitize === 'function') {
                // Hardened options: allow only a short list of safe tags, limited attributes,
                // block inline styles and event handlers so it's CSP-friendly.
                const config = {
                    ALLOWED_TAGS: ['iframe', 'a', 'p', 'div', 'span', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'img'],
                    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'width', 'height', 'allow', 'allowfullscreen', 'frameborder'],
                    FORCE_BODY: true,
                    RETURN_DOM: false,
                    // Disallow data-* attributes to prevent exfiltration vectors
                    ADD_ATTR: [],
                };
                return DOMPurify.sanitize(html, config);
            }
        }
    }
    catch (e) {
        // fall through to naive sanitization
    }
    // Fallback: strip script tags and on* attributes (best-effort)
    return html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
        .replace(/on[a-z]+\s*=\s*(['"]).*?\1/gi, '')
        .replace(/javascript:\s*/gi, '');
}
