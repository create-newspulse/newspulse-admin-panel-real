import { beforeEach, describe, expect, it, vi } from 'vitest';

const { postMock } = vi.hoisted(() => ({
  postMock: vi.fn(),
}));

vi.mock('@/api/adminApi', () => ({
  default: {
    post: postMock,
  },
}));

vi.mock('@/lib/api', () => ({
  adminUrl: (path: string) => `/admin-api/admin${path}`,
}));

import { bulkDeleteReporterContacts } from '../api/reporterDirectory';

describe('bulkDeleteReporterContacts', () => {
  it('does not log selected identities or rejected backend payloads', async () => {
    const marker = 'synthetic-private-marker';
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    try {
      postMock.mockRejectedValueOnce({ response: { status: 500, data: { message: marker } } });
      await bulkDeleteReporterContacts({ ids: [marker], emails: [marker], confirmPermanentDelete: true }).catch(() => undefined);
      expect(info.mock.calls.length).toBeGreaterThan(0);
      expect(JSON.stringify(info.mock.calls).includes(marker)).toBe(false);
    } finally {
      info.mockRestore();
    }
  });

  beforeEach(() => {
    postMock.mockReset();
  });

  it('posts selected ids with explicit confirmPermanentDelete=true to the bulk delete endpoint', async () => {
    postMock.mockResolvedValue({
      data: {
        ok: true,
        deletedCount: 2,
        failedIds: [],
        missingIds: [],
        invalidStateIds: [],
      },
      status: 200,
    });

    const result = await bulkDeleteReporterContacts({
      ids: [' reporter-1 ', 'reporter-2'],
      sourceView: 'removed',
      confirmPermanentDelete: true,
    });

    expect(postMock).toHaveBeenCalledTimes(1);
    expect(postMock).toHaveBeenCalledWith(
      '/community-reporter/contacts/bulk-delete',
      {
        ids: ['reporter-1', 'reporter-2'],
        contactIds: ['reporter-1', 'reporter-2'],
        selectedContactIds: ['reporter-1', 'reporter-2'],
        contributorIds: [],
        reporterKeys: [],
        emails: [],
        sourceView: 'removed',
        action: 'delete-permanently',
        permanent: true,
        hardDelete: true,
        confirmPermanentDelete: true,
      },
      { headers: { 'Content-Type': 'application/json' } }
    );
    expect(result).toEqual({
      ok: true,
      deleted: 2,
      deletedCount: 2,
      failedIds: [],
      missingIds: [],
      invalidStateIds: [],
      failures: [],
      invalidConfirmation: false,
    });
  });

  it('does not call the backend when the selection is empty after cleanup', async () => {
    const result = await bulkDeleteReporterContacts({
      ids: [' ', ''],
      confirmPermanentDelete: true,
    });

    expect(postMock).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, deleted: 0 });
  });

  it('surfaces the backend confirmation error message unchanged', async () => {
    postMock.mockRejectedValue({
      response: {
        status: 400,
        data: {
          message: 'Permanent delete requires explicit confirmation via { ids: [...], confirmPermanentDelete: true }.',
          invalidConfirmation: true,
        },
      },
    });

    await expect(
      bulkDeleteReporterContacts({
        ids: ['reporter-1'],
        confirmPermanentDelete: true,
      })
    ).rejects.toMatchObject({
      message: 'Permanent delete requires explicit confirmation via { ids: [...], confirmPermanentDelete: true }.',
      status: 400,
    });
  });

  it('preserves backend failure details for blocked permanent deletes', async () => {
    postMock.mockResolvedValue({
      data: {
        ok: true,
        deletedCount: 0,
        failedIds: ['reporter-1'],
        missingIds: [],
        invalidStateIds: [],
        failures: [
          {
            id: 'reporter-1',
            code: 'CONTACT_HAS_LINKED_STORIES',
            message: 'Contact has linked stories',
            details: { linkedStories: 1 },
          },
        ],
      },
      status: 200,
    });

    const result = await bulkDeleteReporterContacts({
      ids: ['reporter-1'],
      confirmPermanentDelete: true,
    });

    expect(result).toEqual({
      ok: true,
      deleted: 0,
      deletedCount: 0,
      failedIds: ['reporter-1'],
      missingIds: [],
      invalidStateIds: [],
      failures: [
        {
          id: 'reporter-1',
          code: 'CONTACT_HAS_LINKED_STORIES',
          message: 'Contact has linked stories',
          details: { linkedStories: 1 },
        },
      ],
      invalidConfirmation: false,
    });
  });
});