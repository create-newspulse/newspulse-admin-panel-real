import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminApiClient } from '@/lib/adminApiClient';
import { getPulseDialogueCuration, saveFeaturedDialogue, saveFeaturedVoices } from '@/lib/api/pulseDialogueCuration';

vi.mock('@/lib/adminApiClient', () => ({ adminApiClient: { get: vi.fn(), put: vi.fn() } }));
const client = vi.mocked(adminApiClient, { deep: true });
const firstId = '000000000000000000000001';
const secondId = '000000000000000000000002';
const configuration = {
  featuredDialogue: [
    { id: secondId, title: null, slug: null, status: null, missing: true },
    { id: firstId, title: 'Draft', slug: 'draft', status: 'draft', missing: false },
  ],
  featuredVoices: [
    { id: secondId, name: null, slug: null, status: null, profileVisible: false, missing: true },
    { id: firstId, name: 'Hidden', slug: 'hidden', status: 'inactive', profileVisible: false, missing: false },
  ],
  updatedAt: null,
};

beforeEach(() => vi.resetAllMocks());

describe('Pulse Dialogue curation contract', () => {
  it('loads the exact GET envelope in stored order, retaining unavailable references', async () => {
    client.get.mockResolvedValue({ data: { ok: true, configuration } });
    await expect(getPulseDialogueCuration()).resolves.toEqual(configuration);
    expect(client.get).toHaveBeenCalledExactlyOnceWith('admin/pulse-dialogue/curation', { headers: { 'Cache-Control': 'no-store' } });
  });

  it('accepts the empty configuration', async () => {
    const empty = { featuredDialogue: [], featuredVoices: [], updatedAt: null };
    client.get.mockResolvedValue({ data: { ok: true, configuration: empty } });
    await expect(getPulseDialogueCuration()).resolves.toEqual(empty);
  });

  it.each([null, {}, '<html>Not deployed</html>', { ok: true, articleIds: [], contributorIds: [] }, { ok: true, configuration: { featuredDialogue: [] } }])('rejects malformed data instead of inventing empty lists: %j', async (data) => {
    client.get.mockResolvedValue({ data });
    await expect(getPulseDialogueCuration()).rejects.toThrow('Curation response could not be read');
  });

  it.each([
    [saveFeaturedDialogue, 'featured-dialogue', 'articleIds'],
    [saveFeaturedVoices, 'featured-voices', 'contributorIds'],
  ] as const)('sends exact ordered IDs and permits an explicit clear: %s', async (save, path, field) => {
    client.put.mockResolvedValue({ data: { ok: true, configuration } });
    await expect(save([secondId, firstId])).resolves.toEqual(configuration);
    expect(client.put).toHaveBeenLastCalledWith(`admin/pulse-dialogue/curation/${path}`, { [field]: [secondId, firstId] });
    await save([]);
    expect(client.put).toHaveBeenLastCalledWith(`admin/pulse-dialogue/curation/${path}`, { [field]: [] });
  });

  it.each([saveFeaturedDialogue, saveFeaturedVoices])('rejects duplicates, invalid IDs, and more than six before PUT: %s', async (save) => {
    await expect(save([firstId, firstId])).rejects.toThrow();
    await expect(save(['not-a-news-id'])).rejects.toThrow();
    await expect(save(Array.from({ length: 7 }, (_, index) => String(index).padStart(24, '0')))).rejects.toThrow();
    expect(client.put).not.toHaveBeenCalled();
  });

  it('propagates permission and network failures without fallback requests', async () => {
    const forbidden = { response: { status: 403 } };
    client.get.mockRejectedValue(forbidden);
    await expect(getPulseDialogueCuration()).rejects.toBe(forbidden);
    client.put.mockRejectedValue(new Error('Network Error'));
    await expect(saveFeaturedDialogue([firstId])).rejects.toThrow('Network Error');
    expect(client.get).toHaveBeenCalledTimes(1);
    expect(client.put).toHaveBeenCalledTimes(1);
  });
});