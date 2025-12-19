// Safe URL join to guarantee exactly one '/'
export function joinPath(base: string, path: string) {
  const b = (base || '').replace(/\/+$/, '');
  const p = (path || '').replace(/^\/+/, '');
  return `${b}/${p}`;
}

// Canonical admin proxy base used across the app
export const ADMIN_API_BASE = '/admin-api';

// Helper: build an admin API URL (expects `path` may start with '/api/...')
export function adminApiUrl(path: string) {
  const raw = (path || '').toString().trim();
  const withLeadingSlash = raw.startsWith('/') ? raw : `/${raw}`;
  // IMPORTANT: when using the '/admin-api' proxy base, do not include a leading
  // '/api/' segment. The proxy already rewrites '/admin-api/*' -> backend '/api/*'.
  const normalized = withLeadingSlash.replace(/^\/api\//, '/');
  return joinPath(ADMIN_API_BASE, normalized);
}

export default joinPath;
