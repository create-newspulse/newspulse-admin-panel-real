export interface NormalizedError {
  status: number | null;
  code?: string | null;
  message: string;
  retriable: boolean;
  authExpired: boolean;
  network: boolean;
  raw: any;
}

// Prefer concise human messages; fallback chain.
export function normalizeError(err: any, fallback: string = 'Unexpected error'): NormalizedError {
  if (!err) return { status: null, code: null, message: fallback, retriable: true, authExpired: false, network: false, raw: err };
  const status = err?.response?.status ?? null;
  const data = err?.response?.data || {};
  const code = (data.code || data.errorCode || err.code || null) as string | null;
  const network = !!(err?.message && /Network|timeout|ECONN|ENOTFOUND|Failed to fetch/i.test(err.message));
  // Derive message
  let message = (
    data.message || data.error || err.message || fallback
  );
  if (typeof message !== 'string') message = fallback;
  // Trim overly long messages
  if (message.length > 300) message = message.slice(0,297) + '…';

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
