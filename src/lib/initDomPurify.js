// Initialize DOMPurify in the browser and attach to window.DOMPurify for global use
export default function initDomPurify() {
    if (typeof window === 'undefined')
        return;
    if (window.DOMPurify)
        return;
    try {
        // dynamic import to keep SSR safe
        import('dompurify').then((mod) => {
            window.DOMPurify = mod.default || mod;
        }).catch(() => {
            // ignore if import fails; sanitize.ts has a fallback
        });
    }
    catch (e) {
        // ignore
    }
}
