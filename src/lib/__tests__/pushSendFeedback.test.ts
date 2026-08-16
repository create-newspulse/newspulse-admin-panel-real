import { describe, expect, it } from 'vitest';

import { AdminApiError } from '@/lib/http/adminFetch';
import {
  ARTICLE_PUSH_SPAM_WARNING,
  BREAKING_PUSH_SPAM_WARNING,
  PUSH_SPAM_BLOCKED_MESSAGE,
  isPushSpamBlockedError,
  pushSendErrorMessage,
  sanitizePushSendError,
} from '@/lib/pushSendFeedback';

describe('push send feedback', () => {
  it('keeps article and breaking anti-spam warning copy explicit', () => {
    expect(ARTICLE_PUSH_SPAM_WARNING).toBe('Send only important article alerts. Repeated push notifications may be treated as spam by browsers.');
    expect(BREAKING_PUSH_SPAM_WARNING).toBe('Use Breaking Push only for urgent updates. Repeated breaking alerts may be treated as spam by browsers.');
  });

  it('maps duplicate and rate-limit push errors to the friendly spam-blocked message', () => {
    const duplicate = new AdminApiError('Duplicate push blocked', { status: 409, url: '/admin-api/admin/push/article' });
    const rateLimit = new AdminApiError('Too many push requests', { status: 429, url: '/admin-api/admin/push/breaking' });

    expect(isPushSpamBlockedError(duplicate)).toBe(true);
    expect(isPushSpamBlockedError(rateLimit)).toBe(true);
    expect(pushSendErrorMessage(duplicate, 'Article push failed.')).toBe(PUSH_SPAM_BLOCKED_MESSAGE);
    expect(pushSendErrorMessage(rateLimit, 'Breaking push failed.')).toBe(PUSH_SPAM_BLOCKED_MESSAGE);
  });

  it('sanitizes non-spam push errors before display', () => {
    const error = new AdminApiError('token=abcdef123456 fid=my-fid service unavailable', {
      status: 500,
      url: '/admin-api/admin/push/article',
      body: { message: 'registrationId=secret-registration privateKey=secret-key' },
    });

    expect(isPushSpamBlockedError(error)).toBe(false);
    expect(pushSendErrorMessage(error, 'Article push failed.')).toMatch(/^Article push failed\./);
    expect(sanitizePushSendError(error)).not.toMatch(/abcdef123456|my-fid|secret-registration|secret-key/i);
  });
});