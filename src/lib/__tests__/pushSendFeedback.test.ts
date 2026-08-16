import { describe, expect, it } from 'vitest';

import { AdminApiError } from '@/lib/http/adminFetch';
import {
  ARTICLE_PUSH_SPAM_WARNING,
  BREAKING_PUSH_SPAM_WARNING,
  DUPLICATE_PUSH_BLOCKED_MESSAGE,
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

  it('maps duplicate_push_blocked push errors to the friendly duplicate message', () => {
    const duplicate = new AdminApiError('Duplicate push blocked', {
      status: 409,
      url: '/admin-api/admin/push/article',
      body: { code: 'duplicate_push_blocked', error: 'Duplicate push blocked by backend' },
      code: 'duplicate_push_blocked',
    });

    expect(isPushSpamBlockedError(duplicate)).toBe(true);
    expect(pushSendErrorMessage(duplicate, 'Article push failed.')).toBe(DUPLICATE_PUSH_BLOCKED_MESSAGE);
  });

  it('maps push_rate_limited push errors to the friendly rate-limit message', () => {
    const rateLimit = new AdminApiError('Too many push requests', {
      status: 429,
      url: '/admin-api/admin/push/breaking',
      body: { code: 'push_rate_limited', error: 'Too many push requests' },
      code: 'push_rate_limited',
    });

    expect(isPushSpamBlockedError(rateLimit)).toBe(true);
    expect(pushSendErrorMessage(rateLimit, 'Breaking push failed.')).toBe(PUSH_SPAM_BLOCKED_MESSAGE);
  });

  it('does not show raw backend stack details for friendly push blocks', () => {
    const error = new AdminApiError('Error: duplicate\n    at sendPush (/srv/server.js:10:5)', {
      status: 409,
      url: '/admin-api/admin/push/article',
      body: {
        code: 'duplicate_push_blocked',
        stack: 'Error: duplicate\n    at sendPush (/srv/server.js:10:5)',
      },
      code: 'duplicate_push_blocked',
    });

    const message = pushSendErrorMessage(error, 'Article push failed.');

    expect(message).toBe(DUPLICATE_PUSH_BLOCKED_MESSAGE);
    expect(message).not.toMatch(/sendPush|server\.js|stack|Error:/i);
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