export interface NormalizedError {
  status: number | null;
  code?: string | null;
  message: string;
  retriable: boolean;
  authExpired: boolean;
  network: boolean;
  raw: any;
}

const SAFE_ERROR_MESSAGES = new Set([
  'Access Denied. Founder permission is required.',
  'Contact has linked stories',
  'Permanent delete requires explicit confirmation via { ids: [...], confirmPermanentDelete: true }.',
  'Invalid email or password',
  'Invalid OTP',
  'OTP expired',
  'Passwords do not match',
]);

export function safeErrorMessage(error: any, fallback: string): string {
  const status = error?.response?.status ?? error?.status;
  if (typeof status === 'number' && status >= 500) return fallback;
  const message = error?.response?.data?.message ?? error?.body?.message ?? error?.message;
  if (typeof message === 'string' && SAFE_ERROR_MESSAGES.has(message)) return message;
  if (status === 401 || status === 419) return 'Your session has expired. Please sign in again.';
  if (status === 403) return 'Access denied. You do not have permission for this action.';
  if (status === 429) return 'Too many requests. Please try again later.';
  if (status === 409) return 'This record has changed. Refresh and try again.';
  return fallback;
}

// Prefer concise human messages; fallback chain.
export function normalizeError(err: any, fallback: string = 'Unexpected error'): NormalizedError {
  if (!err) return { status: null, code: null, message: fallback, retriable: true, authExpired: false, network: false, raw: err };
  const status = err?.response?.status ?? null;
  const data = err?.response?.data || {};
  const code = (data.code || data.errorCode || err.code || null) as string | null;
  const network = !!(err?.message && /Network|timeout|ECONN|ENOTFOUND|Failed to fetch/i.test(err.message));
  // Derive message
  const message = safeErrorMessage(err, fallback);

  const authExpired = status === 401 || status === 419;
  // Simple retriable heuristic
  const retriable = network || status === 429 || (status !== null && status >= 500 && status !== 501);

  return { status, code, message, retriable, authExpired, network, raw: err };
}

// Helper to join previous error + new normalized error for UI stacking.
export function appendError(prev: string | null, next: NormalizedError): string {
  if (!prev) return next.message;
  if (prev.includes(next.message)) return prev;
  return prev + ' | ' + next.message;
}
