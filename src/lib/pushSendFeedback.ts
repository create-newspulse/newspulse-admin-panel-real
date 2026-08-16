import { AdminApiError } from '@/lib/http/adminFetch';

export const ARTICLE_PUSH_SPAM_WARNING = 'Send only important article alerts. Repeated push notifications may be treated as spam by browsers.';
export const BREAKING_PUSH_SPAM_WARNING = 'Use Breaking Push only for urgent updates. Repeated breaking alerts may be treated as spam by browsers.';
export const PUSH_SPAM_BLOCKED_MESSAGE = 'Push blocked to prevent notification spam. Please wait and try again.';
export const DUPLICATE_PUSH_BLOCKED_MESSAGE = 'Duplicate push blocked. Please wait before sending this alert again.';

function pushErrorCode(input: unknown): string {
  if (input instanceof AdminApiError) return String(input.code || (input.body as any)?.code || '').trim().toLowerCase();
  return String((input as any)?.code || (input as any)?.body?.code || (input as any)?.response?.data?.code || '').trim().toLowerCase();
}

function stringifyErrorBody(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

export function sanitizePushSendError(input: unknown): string {
  const raw = [
    input instanceof AdminApiError ? input.code : '',
    input instanceof AdminApiError ? stringifyErrorBody(input.body) : '',
    String((input as any)?.message || input || ''),
  ].filter(Boolean).join(' ').trim();

  return raw
    .replace(/-----BEGIN[\s\S]*?-----END[^-]+-----/gi, '[redacted]')
    .replace(/"?stack"?\s*:\s*"[\s\S]*?(?=",\s*"|"\s*}|$)/gi, '"stack":"[redacted]')
    .replace(/\n\s*at\s+[^\n\r]+/gi, '')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted]')
    .replace(/\b(?:token|fid|registration[_ -]?id|private[_ -]?key|client[_ -]?email)\b\s*[:=]\s*["']?[^"',\s}]+/gi, '[redacted]')
    .replace(/\b[A-Za-z0-9_-]{64,}\b/g, '[redacted]')
    .slice(0, 160)
    .trim();
}

export function isPushSpamBlockedError(input: unknown): boolean {
  const code = pushErrorCode(input);
  if (code === 'push_rate_limited' || code === 'duplicate_push_blocked') return true;

  const status = input instanceof AdminApiError ? input.status : Number((input as any)?.status || (input as any)?.response?.status || 0);
  if (status === 429 || status === 409) return true;

  const text = sanitizePushSendError(input).toLowerCase();
  return /rate[\s-]?limit|too many|duplicate|already sent|cooldown|throttl|spam/.test(text);
}

export function pushSendErrorMessage(input: unknown, fallback: string): string {
  const code = pushErrorCode(input);
  if (code === 'duplicate_push_blocked') return DUPLICATE_PUSH_BLOCKED_MESSAGE;
  if (code === 'push_rate_limited') return PUSH_SPAM_BLOCKED_MESSAGE;

  const status = input instanceof AdminApiError ? input.status : Number((input as any)?.status || (input as any)?.response?.status || 0);
  if (status === 409) return DUPLICATE_PUSH_BLOCKED_MESSAGE;
  if (isPushSpamBlockedError(input)) return PUSH_SPAM_BLOCKED_MESSAGE;

  const detail = sanitizePushSendError(input);
  return detail ? `${fallback} ${detail}` : fallback;
}