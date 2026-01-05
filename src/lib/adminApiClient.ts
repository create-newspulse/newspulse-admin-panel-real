import api, { getAuthToken } from './api';
import { adminFetch, adminJson } from './http/adminFetch';

// Back-compat module:
// - Removes hardcoded origins and deprecated env vars.
// - Keeps the same exported names used by existing code.

export function getToken(): string | null {
  return getAuthToken();
}

// Axios client used by a few legacy admin panels.
// It shares the same VITE_API_URL + path normalization as the main `api` client.
export const adminApiClient = api;

export { adminFetch, adminJson };
