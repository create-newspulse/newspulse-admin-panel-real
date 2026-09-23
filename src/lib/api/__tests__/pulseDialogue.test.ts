import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createPulseDialogueContributor,
  getPulseDialogueContributor,
  listPulseDialogueContributors,
  updatePulseDialogueContributor,
} from '@/lib/api/pulseDialogue';
import { adminApiClient } from '@/lib/adminApiClient';

vi.mock('@/lib/adminApiClient', () => ({
  adminApiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

const client = vi.mocked(adminApiClient, { deep: true });

afterEach(() => {
  vi.clearAllMocks();
});

describe('Pulse Dialogue contributor API', () => {
  it('lists contributors through the existing admin API client', async () => {
    client.get.mockResolvedValueOnce({ data: { items: [{ _id: 'c1', canonicalName: 'Writer' }], total: 1, page: 1, limit: 20 } });

    const result = await listPulseDialogueContributors({ q: 'writer' });

    expect(client.get).toHaveBeenCalledWith('admin/pulse-dialogue/contributors', { params: { page: 1, limit: 20, q: 'writer' } });
    expect(result.items[0].id).toBe('c1');
  });

  it('gets, creates, and updates contributors', async () => {
    client.get.mockResolvedValueOnce({ data: { contributor: { _id: 'c1', canonicalName: 'Writer' } } });
    client.post.mockResolvedValueOnce({ data: { contributor: { _id: 'c2', canonicalName: 'New Writer' } } });
    client.put.mockResolvedValueOnce({ data: { contributor: { _id: 'c2', canonicalName: 'Updated Writer' } } });

    await expect(getPulseDialogueContributor('c1')).resolves.toMatchObject({ id: 'c1' });
    await expect(createPulseDialogueContributor({ canonicalName: 'New Writer' })).resolves.toMatchObject({ id: 'c2' });
    await expect(updatePulseDialogueContributor('c2', { canonicalName: 'Updated Writer' })).resolves.toMatchObject({ id: 'c2' });

    expect(client.get).toHaveBeenCalledWith('admin/pulse-dialogue/contributors/c1');
    expect(client.post).toHaveBeenCalledWith('admin/pulse-dialogue/contributors', { canonicalName: 'New Writer' });
    expect(client.put).toHaveBeenCalledWith('admin/pulse-dialogue/contributors/c2', { canonicalName: 'Updated Writer' });
  });
});