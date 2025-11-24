// Streamlined adminApi.ts
// Minimal, robust axios client with normalized JWT attachment and 401 handling.
// Re-export unified implementation in src/lib/adminApi to avoid divergence.
// This ensures cookies (withCredentials true) and path probing logic are used.
export * from '../lib/adminApi';
export { adminApi as default } from '../lib/adminApi';
