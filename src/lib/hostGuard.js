// 📁 src/lib/hostGuard.ts
// Lightweight host allow-list used to avoid locking the app out in production previews.
export function isAllowedHost() {
    try {
        const raw = (import.meta.env.VITE_ALLOWED_HOSTS || '').trim();
        if (!raw)
            return true; // empty list = allow all (safer for previews)
        const list = raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
        const host = typeof window !== 'undefined' ? window.location.host.toLowerCase() : '';
        const origin = typeof window !== 'undefined' ? window.location.origin.toLowerCase() : '';
        return list.includes(host) || list.includes(origin);
    }
    catch (err) {
        // If anything goes wrong, allow (avoid locking you out).
        return true;
    }
}
