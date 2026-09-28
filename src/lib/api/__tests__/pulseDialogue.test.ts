import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createPulseDialogueContributor,
  getPulseDialogueContributor,
  getPulseDialogueContributorCapabilities,
  listPulseDialogueContributors,
  updatePulseDialogueContributor,
  changePulseDialogueContributorSlug,
  listPulseDialogueSeries,
  getPulseDialogueSeries,
  createPulseDialogueSeries,
  updatePulseDialogueSeries,
} from '@/lib/api/pulseDialogue';
import { adminApiClient } from '@/lib/adminApiClient';

vi.mock('@/lib/adminApiClient', () => ({
  adminApiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
  },
}));

const client = vi.mocked(adminApiClient, { deep: true });

afterEach(() => {
  vi.clearAllMocks();
});

describe('Pulse Dialogue contributor API', () => {
  it.each([false, true])('reads the authenticated slug capability %s without caching', async (slugRename) => {
    client.get.mockResolvedValueOnce({ data: { ok: true, success: true, capabilities: { slugRename }, data: { capabilities: { slugRename } } } });
    const signal = new AbortController().signal;
    await expect(getPulseDialogueContributorCapabilities(signal)).resolves.toEqual({ slugRename });
    expect(client.get).toHaveBeenCalledExactlyOnceWith('admin/pulse-dialogue/contributors/capabilities', {
      signal, timeout: 5000, headers: { 'Cache-Control': 'no-store' },
    });
  });

  it.each([
    { ok: true, success: true, capabilities: { slugRename: true } },
    { ok: true, success: true, data: { capabilities: { slugRename: true } } },
  ])('accepts either documented capability envelope', async (data) => {
    client.get.mockResolvedValueOnce({ data });
    await expect(getPulseDialogueContributorCapabilities()).resolves.toEqual({ slugRename: true });
  });

  it.each([
    null, undefined, '<html>Unavailable</html>', [], {},
    { ok: true, success: true },
    { ok: true, success: true, capabilities: {} },
    { ok: true, success: true, capabilities: { slugRename: 'true' } },
    { ok: true, success: true, capabilities: { slugRename: 1 } },
    { ok: true, success: true, capabilities: { slugRename: null } },
    { ok: false, success: true, capabilities: { slugRename: true } },
    { ok: true, success: false, capabilities: { slugRename: true } },
    { capabilities: { slugRename: true } },
    { ok: true, success: true, capabilities: { slugRename: true }, data: { capabilities: { slugRename: false } } },
    { ok: true, success: true, capabilities: { slugRename: false }, data: { capabilities: { slugRename: true } } },
    { ok: true, success: true, capabilities: {}, data: { capabilities: { slugRename: true } } },
  ])('fails closed for missing, malformed, or conflicting capability data: %j', async (data) => {
    client.get.mockResolvedValueOnce({ data });
    await expect(getPulseDialogueContributorCapabilities()).resolves.toEqual({ slugRename: false });
    expect(client.patch).not.toHaveBeenCalled();
  });

  it.each([new Error('Unavailable'), { code: 'ECONNABORTED' }, { code: 'ERR_CANCELED' }])('fails closed on request failure or timeout: %j', async (error) => {
    client.get.mockRejectedValueOnce(error);
    await expect(getPulseDialogueContributorCapabilities()).resolves.toEqual({ slugRename: false });
  });

  it('separates profile updates from explicit slug changes', async () => {
    client.put.mockResolvedValue({ data: { contributor: { id: 'c1' } } });
    client.patch.mockResolvedValue({ data: { contributor: { id: 'c1', slug: 'new-url' } } });
    const profile = { canonicalName: 'Renamed', slug: 'must-not-send', profileVisible: false, status: 'hidden' };
    await updatePulseDialogueContributor('c1', profile);
    expect(client.put).toHaveBeenCalledWith('admin/pulse-dialogue/contributors/c1', { canonicalName: 'Renamed', profileVisible: false, status: 'hidden' });
    await expect(changePulseDialogueContributorSlug('c1', 'new-url')).resolves.toMatchObject({ slug: 'new-url' });
    expect(client.patch).toHaveBeenCalledExactlyOnceWith('admin/pulse-dialogue/contributors/c1/slug', { slug: 'new-url' });
  });

  it('lists, reads, creates and edits Series without editing its slug', async () => {
    const series = { _id: 's1', title: 'Ideas', slug: 'ideas', ownerContributorId: 'c1', profileVisible: false };
    client.get.mockResolvedValueOnce({ data: { items: [series], total: 1 } });
    expect((await listPulseDialogueSeries()).items[0]).toMatchObject({ id: 's1', slug: 'ideas', profileVisible: false });
    expect(client.get).toHaveBeenLastCalledWith('admin/pulse-dialogue/series', { params: { page: 1, limit: 20 } });
    client.get.mockResolvedValueOnce({ data: { series } });
    await expect(getPulseDialogueSeries('s1')).resolves.toMatchObject({ id: 's1' });
    client.post.mockResolvedValueOnce({ data: { series } });
    await createPulseDialogueSeries({ title: 'Ideas', slug: 'ideas', ownerContributorId: 'c1', profileVisible: false });
    expect(client.post).toHaveBeenLastCalledWith('admin/pulse-dialogue/series', { title: 'Ideas', slug: 'ideas', ownerContributorId: 'c1', profileVisible: false });
    client.put.mockResolvedValueOnce({ data: { series } });
    const edit = { title: 'New Ideas', slug: 'ignored', description: null, ownerContributorId: null, profileVisible: true };
    await updatePulseDialogueSeries('s1', edit);
    expect(client.put).toHaveBeenLastCalledWith('admin/pulse-dialogue/series/s1', { title: 'New Ideas', description: null, ownerContributorId: null, profileVisible: true });
  });
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