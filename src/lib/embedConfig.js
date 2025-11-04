// embedConfig: load allowed hosts from env (Vite) or use defaults
const DEFAULT_ALLOWED = [
    'youtube.com',
    'www.youtube.com',
    'youtube-nocookie.com',
    'player.vimeo.com',
    'vimeo.com',
    'ted.com',
    'www.ted.com',
    'airvuz.com',
    'www.airvuz.com',
];
export function getAllowedHosts() {
    try {
        // Vite exposes env vars starting with VITE_
        const raw = import.meta.env?.VITE_EMBED_ALLOWLIST || process.env.VITE_EMBED_ALLOWLIST || '';
        if (!raw)
            return DEFAULT_ALLOWED;
        return raw.split(',').map((s) => s.trim()).filter(Boolean);
    }
    catch (e) {
        return DEFAULT_ALLOWED;
    }
}
