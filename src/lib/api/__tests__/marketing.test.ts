import { beforeEach, describe, expect, it, vi } from 'vitest';

import { adminApiClient } from '@/lib/adminApiClient';
import { getMarketingWorkspace, MARKETING_SUMMARY_ENDPOINT, MarketingApiError } from '@/lib/api/marketing';

vi.mock('@/lib/adminApiClient', () => ({
  adminApiClient: {
    get: vi.fn(),
    put: vi.fn(),
  },
}));

describe('marketing API client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads Marketing from the canonical authenticated summary endpoint without fake data', async () => {
    vi.mocked(adminApiClient.get).mockResolvedValue({
      data: {
        ok: true,
        counts: {
          activeAdvertiserCampaigns: 0,
          completedAdvertiserCampaigns: 0,
          activePromotions: 0,
          completedPromotions: 0,
          renewalsDue: 0,
          reportsReady: 0,
        },
        analytics: {
          status: 'not_connected',
          websiteUsers: null,
          campaignSessions: null,
        },
      },
    } as any);

    const workspace = await getMarketingWorkspace();

    expect(adminApiClient.get).toHaveBeenCalledWith(MARKETING_SUMMARY_ENDPOINT);
    expect(workspace.advertisers).toEqual([]);
    expect(workspace.followUps).toEqual([]);
    expect(workspace.proposals).toEqual([]);
    expect(workspace.partnerships).toEqual([]);
    expect(workspace.campaignReports).toEqual([]);
    expect(workspace.renewals).toEqual([]);
    expect(JSON.stringify(workspace)).not.toMatch(/sample|50K|87%|500K/i);
  });

  it('preserves Marketing permission failures for the page error state', async () => {
    vi.mocked(adminApiClient.get).mockRejectedValue({
      response: {
        status: 403,
        data: { ok: false, code: 'FORBIDDEN', message: 'Access denied' },
      },
    });

    await expect(getMarketingWorkspace()).rejects.toMatchObject({
      name: 'MarketingApiError',
      status: 403,
      code: 'FORBIDDEN',
      endpoint: MARKETING_SUMMARY_ENDPOINT,
      message: 'Access denied',
    });
  });
});