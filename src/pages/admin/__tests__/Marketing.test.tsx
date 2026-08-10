import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { adminApi } from '@/lib/api';
import { getAdminAnalyticsDashboard, listAdminAnalyticsCategories } from '@/lib/api/adminAnalytics';
import { listArticles } from '@/lib/api/articles';
import { MarketingApiError, getMarketingWorkspace, saveMarketingWorkspace } from '@/lib/api/marketing';
import { createEmptyMarketingData, type MarketingData } from '@/lib/marketing';
import Marketing from '@/pages/admin/Marketing';

vi.mock('@/lib/api/adminAnalytics', () => ({
  getAdminAnalyticsDashboard: vi.fn(),
  listAdminAnalyticsCategories: vi.fn(),
}));

vi.mock('@/lib/api/articles', () => ({
  listArticles: vi.fn(),
}));

vi.mock('@/lib/api/marketing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/marketing')>();
  return {
    MarketingApiError: actual.MarketingApiError,
    getMarketingWorkspace: vi.fn(),
    saveMarketingWorkspace: vi.fn(),
  };
});

function latestSavedWorkspace(): MarketingData {
  const calls = vi.mocked(saveMarketingWorkspace).mock.calls;
  return calls[calls.length - 1]?.[0] as MarketingData;
}

describe('Marketing page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    vi.mocked(getMarketingWorkspace).mockResolvedValue(createEmptyMarketingData());
    vi.mocked(saveMarketingWorkspace).mockImplementation(async (workspace) => workspace);
    vi.mocked(getAdminAnalyticsDashboard).mockRejectedValue(new Error('not connected'));
    vi.mocked(listAdminAnalyticsCategories).mockResolvedValue({ rows: [] });
    vi.mocked(listArticles).mockResolvedValue({ rows: [], total: 0, page: 1, pages: 1 });
  });

  it('renders the Marketing route identity, internal navigation, empty activity, and no fake metrics', async () => {
    render(<Marketing />);

    expect(screen.getByRole('heading', { name: 'Marketing' })).toBeInTheDocument();
    expect(screen.getByText('Grow the News Pulse audience, promote the website, build advertiser relationships and manage marketing campaigns.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /marketing settings/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Advertisers' })).toBeInTheDocument();
    expect(await screen.findByText('No active marketing activity yet.')).toBeInTheDocument();
    expect(screen.getByText('Advertiser Leads')).toBeInTheDocument();
    expect(screen.getByText('Follow-ups Due')).toBeInTheDocument();
    expect(screen.getByText('Open Proposals')).toBeInTheDocument();
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
    expect(screen.queryByText(/50K|87%|500K/i)).not.toBeInTheDocument();
    expect(getMarketingWorkspace).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem('np_marketing_workspace_v2')).toBeNull();
  });

  it('classifies admin auth failures and retries the Marketing backend load', async () => {
    vi.mocked(getMarketingWorkspace)
      .mockRejectedValueOnce(new MarketingApiError('/marketing', { response: { status: 401, data: { ok: false, success: false, status: 401, code: 'UNAUTHORIZED', message: 'Unauthorized' } } }))
      .mockResolvedValueOnce(createEmptyMarketingData());

    render(<Marketing />);

    expect(await screen.findByText(/backend rejected the admin session with 401 Unauthorized/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('No active marketing activity yet.')).toBeInTheDocument();
    expect(getMarketingWorkspace).toHaveBeenCalledTimes(2);
  });

  it('renders the Advertisers empty state', async () => {
    render(<Marketing />);

    fireEvent.click(screen.getByRole('tab', { name: 'Advertisers' }));

    expect(await screen.findByRole('heading', { name: 'Corporate Advertisers' })).toBeInTheDocument();
    expect(await screen.findByText('No advertisers yet.')).toBeInTheDocument();
    expect(screen.getByText('Add your first advertiser or create a lead from an advertising enquiry.')).toBeInTheDocument();
  });

  it('loads each Marketing section with real empty or Not Connected states', async () => {
    render(<Marketing />);

    fireEvent.click(screen.getByRole('tab', { name: 'Advertisers' }));
    expect(await screen.findByRole('heading', { name: 'Corporate Advertisers' })).toBeInTheDocument();
    expect(screen.getByText('No advertisers yet.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Follow-ups' }));
    expect(await screen.findAllByText('No follow-ups scheduled.')).toHaveLength(4);

    fireEvent.click(screen.getByRole('tab', { name: 'Proposals' }));
    expect(await screen.findByRole('heading', { name: 'Proposals' })).toBeInTheDocument();
    expect(screen.getByText('No proposals yet.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Partnerships' }));
    expect(await screen.findByRole('heading', { name: 'Partnerships' })).toBeInTheDocument();
    expect(screen.getByText('No partnerships yet.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Campaigns' }));
    expect(await screen.findByText('No won deals ready for Ads Manager.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Audience' }));
    expect(await screen.findByRole('heading', { name: 'Audience Growth' })).toBeInTheDocument();
    expect(screen.getAllByText('Not Connected').length).toBeGreaterThan(5);

    fireEvent.click(screen.getByRole('tab', { name: 'Promotion' }));
    expect(await screen.findByRole('heading', { name: 'Website Promotion' })).toBeInTheDocument();
    expect(screen.getByText('No promotion campaigns yet.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Performance' }));
    expect(await screen.findByRole('heading', { name: 'Marketing Performance' })).toBeInTheDocument();
    expect(screen.getByText('Campaign performance is not available yet when verified impression/click tracking is not connected.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Renewals' }));
    expect(await screen.findByRole('heading', { name: 'Renewals' })).toBeInTheDocument();
    expect(screen.getByText('No renewals due.')).toBeInTheDocument();
  });

  it('validates required Add Advertiser form fields', async () => {
    render(<Marketing />);

    fireEvent.click(screen.getByRole('tab', { name: 'Advertisers' }));
    await screen.findByText('No advertisers yet.');
    fireEvent.click(screen.getAllByRole('button', { name: /add advertiser/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Save Advertiser' }));

    expect(screen.getByText('Company Name is required.')).toBeInTheDocument();
    expect(screen.getByText('Industry is required.')).toBeInTheDocument();
    expect(screen.getByText('Contact Person is required.')).toBeInTheDocument();
    expect(screen.getByText('Email is required.')).toBeInTheDocument();
  });

  it('saves a real advertiser lead with New Lead as the default stage through the backend', async () => {
    render(<Marketing />);

    fireEvent.click(screen.getByRole('tab', { name: 'Advertisers' }));
    await screen.findByText('No advertisers yet.');
    fireEvent.click(screen.getAllByRole('button', { name: /add advertiser/i })[0]);
    fireEvent.change(screen.getByLabelText(/Company Name/i), { target: { value: 'Acme Retail' } });
    fireEvent.change(screen.getByLabelText(/Industry/i), { target: { value: 'Retail' } });
    fireEvent.change(screen.getByLabelText(/Contact Person/i), { target: { value: 'Nina Shah' } });
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'nina@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Advertiser' }));

    const row = screen.getAllByText('Acme Retail').map((element) => element.closest('tr')).find(Boolean);
    expect(row).not.toBeNull();
    expect(within(row as HTMLTableRowElement).getByDisplayValue('New Lead')).toBeInTheDocument();

    await waitFor(() => expect(saveMarketingWorkspace).toHaveBeenCalled());
    const saved = latestSavedWorkspace();
    expect(saved.advertisers[0].stage).toBe('new_lead');
    expect(saved.advertisers[0].contacts[0].name).toBe('Nina Shah');
    expect(window.localStorage.getItem('np_marketing_workspace_v2')).toBeNull();
  });

  it('shows Audience Growth with Not Connected states instead of fake traffic', async () => {
    render(<Marketing />);

    fireEvent.click(screen.getByRole('tab', { name: 'Audience' }));

    expect(await screen.findByRole('heading', { name: 'Audience Growth' })).toBeInTheDocument();
    expect(screen.getByText('Understand how readers discover News Pulse and plan sustainable growth across English, Hindi and Gujarati audiences.')).toBeInTheDocument();
    expect((await screen.findAllByText('Connect verified analytics sources to display real audience performance.')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Not Connected').length).toBeGreaterThan(5);
    expect(screen.queryByText(/50K|87%|500K/i)).not.toBeInTheDocument();
  });

  it('maps real analytics into Audience language and source views when available', async () => {
    vi.mocked(getAdminAnalyticsDashboard).mockResolvedValue({ totals: { users: 1200, newUsers: 700, returningUsers: 500, sessions: 1600, pageViews: 3400, engagedReads: 900 }, sources: [{ source: 'Organic Search', users: 450, sessions: 600, share: 37 }], languages: [{ language: 'English', users: 800, sessions: 1000, views: 2100, engagement: 60 }] } as any);
    vi.mocked(listAdminAnalyticsCategories).mockResolvedValue({ rows: [{ category: 'national', readers: 320, views: 900, engagedReads: 220 }] } as any);
    render(<Marketing />);

    fireEvent.click(screen.getByRole('tab', { name: 'Audience' }));

    expect(await screen.findByText('1,200')).toBeInTheDocument();
    expect(screen.getByText('Organic Search')).toBeInTheDocument();
    expect(screen.getAllByText('450').length).toBeGreaterThan(0);
    expect(screen.getAllByText('English').length).toBeGreaterThan(0);
    expect(screen.getByText('National')).toBeInTheDocument();
  });

  it('creates growth goals without fabricating current analytics progress', async () => {
    render(<Marketing />);

    fireEvent.click(screen.getByRole('tab', { name: 'Audience' }));
    fireEvent.change(await screen.findByLabelText(/Goal Name/i), { target: { value: 'Gujarati Readers' } });
    fireEvent.change(screen.getByLabelText(/Target Value/i), { target: { value: '10000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Growth Goal' }));

    expect(await screen.findByText('Current: Unavailable')).toBeInTheDocument();
    expect(screen.getByText('Progress: Cannot calculate')).toBeInTheDocument();
    await waitFor(() => expect(saveMarketingWorkspace).toHaveBeenCalled());
    const saved = latestSavedWorkspace();
    expect(saved.growthGoals[0].currentVerifiedValue).toBeNull();
  });

  it('creates Website Promotions, UTM links, calendar items, manual activity, status changes, and archives', async () => {
    render(<Marketing />);

    fireEvent.click(screen.getByRole('tab', { name: 'Promotion' }));
    fireEvent.change(await screen.findByLabelText(/Campaign Name/i), { target: { value: 'Gujarati Growth Campaign' } });
    fireEvent.change(screen.getByLabelText(/Destination URL/i), { target: { value: 'https://www.newspulse.co.in/gu' } });
    fireEvent.click(screen.getByLabelText('Instagram'));
    fireEvent.click(screen.getByLabelText('WhatsApp'));
    fireEvent.click(screen.getByRole('button', { name: 'Save Campaign' }));

    expect(screen.getByText('Gujarati Growth Campaign')).toBeInTheDocument();
    fireEvent.change(screen.getByDisplayValue('Draft'), { target: { value: 'Active' } });
    expect(screen.getByDisplayValue('Active')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /UTM Builder/i }));
    await waitFor(() => expect(saveMarketingWorkspace).toHaveBeenCalled());
    const promotionId = latestSavedWorkspace().promotions[0].id;
  fireEvent.change(screen.getByLabelText('Promotion'), { target: { value: promotionId } });
    fireEvent.change(screen.getByLabelText(/utm_source/i), { target: { value: 'instagram' } });
    fireEvent.change(screen.getByLabelText(/utm_medium/i), { target: { value: 'social' } });
    fireEvent.change(screen.getByLabelText(/utm_campaign/i), { target: { value: 'gujarati growth' } });
    expect(screen.getByText(/utm_campaign=Gujarati_Growth_Campaign|utm_campaign=gujarati_growth/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save UTM Link' }));

    fireEvent.click(screen.getByRole('tab', { name: 'Calendar' }));
  fireEvent.change(screen.getByLabelText('Promotion'), { target: { value: promotionId } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Calendar Item' }));

    fireEvent.click(screen.getByRole('tab', { name: 'Channels' }));
  fireEvent.change(screen.getByLabelText('Promotion'), { target: { value: promotionId } });
    fireEvent.click(screen.getByRole('button', { name: 'Log Activity' }));
    expect(screen.getByText('Campaign performance is not connected.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Workspace' }));
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));

    await waitFor(() => {
      const saved = latestSavedWorkspace();
      expect(saved.promotions[0].archivedAt).toBeTruthy();
      expect(saved.promotions[0].links).toHaveLength(1);
      expect(saved.promotions[0].calendarItems).toHaveLength(1);
      expect(saved.promotions[0].channelActivities).toHaveLength(1);
    });
  }, 20000);

  it('uses grouped real proposal inventory, keeps OFF placements selectable, and preserves proposal data', async () => {
    vi.spyOn(adminApi, 'get').mockResolvedValue({ data: { slotEnabled: { HOME_RIGHT_300x250: false, BREAKING_SPONSOR: true } } } as any);
    const { unmount } = render(<Marketing />);

    fireEvent.click(screen.getByRole('tab', { name: 'Advertisers' }));
    await screen.findByText('No advertisers yet.');
    fireEvent.click(screen.getAllByRole('button', { name: /add advertiser/i })[0]);
    fireEvent.change(screen.getByLabelText(/Company Name/i), { target: { value: 'Acme Retail' } });
    fireEvent.change(screen.getByLabelText(/Industry/i), { target: { value: 'Retail' } });
    fireEvent.change(screen.getByLabelText(/Contact Person/i), { target: { value: 'Nina Shah' } });
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'nina@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Advertiser' }));

    fireEvent.click(screen.getByRole('tab', { name: 'Proposals' }));
    const productSelect = screen.getByLabelText('Product') as HTMLSelectElement;
    const productNames = within(productSelect).getAllByRole('option').map((option) => option.textContent);
    expect(productNames).toContain('Home Right Rail 300×250');
    expect(productNames).toContain('Breaking Sponsor');
    expect(productNames).toContain('Live Update Sponsor');
    expect(productNames).toContain('Sponsored Feature');
    expect(productNames).toContain('Sponsored Article');
    expect(productNames).toContain('Combo Campaign');
    expect(productNames).not.toContain('Section Sponsorship');
    expect(productNames).not.toContain('Video Advertisement');

    fireEvent.change(productSelect, { target: { value: 'HOME_RIGHT_300x250' } });
    await waitFor(() => expect(screen.getAllByText('OFF').length).toBeGreaterThan(0));
    fireEvent.change(screen.getByLabelText(/Duration \/ quantity/i), { target: { value: '30 days' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Line Item' }));
    expect(screen.getByText('HOME_RIGHT_300x250')).toBeInTheDocument();

    fireEvent.change(productSelect, { target: { value: 'BREAKING_SPONSOR' } });
    await waitFor(() => expect(screen.getAllByText('ON').length).toBeGreaterThan(0));
    fireEvent.change(screen.getByLabelText(/Duration \/ quantity/i), { target: { value: '7 days' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Line Item' }));
    expect(screen.getByText('BREAKING_SPONSOR')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Proposal Title/i), { target: { value: 'Acme Launch' } });
    fireEvent.change(screen.getByLabelText(/Campaign Objective/i), { target: { value: 'Launch campaign' } });
    fireEvent.click(screen.getByRole('button', { name: '+ Create Proposal' }));

    await waitFor(() => expect(saveMarketingWorkspace).toHaveBeenCalled());
    const saved = latestSavedWorkspace();
    expect(saved.proposals[0].items.map((item: any) => item.placementId)).toEqual(['HOME_RIGHT_300x250', 'BREAKING_SPONSOR']);
    expect(saved.proposals[0].items[0].listPrice).toBe('');
    expect(saved.proposals[0].items[0].finalPrice).toBe('');

    unmount();
  vi.mocked(getMarketingWorkspace).mockResolvedValue(saved);
    render(<Marketing />);
    fireEvent.click(screen.getByRole('tab', { name: 'Proposals' }));
    expect(await screen.findByText('Acme Launch')).toBeInTheDocument();
    expect(screen.getAllByText(/HOME_RIGHT_300x250/).length).toBeGreaterThan(0);
  }, 20000);

  it('creates Phase 4 campaign reports through the backend workspace API without fake results', async () => {
    const workspace: MarketingData = {
      ...createEmptyMarketingData(),
      advertisers: [{ id: 'adv-1', companyName: 'Acme Retail', industry: 'Retail', contactPerson: 'Nina', email: 'nina@example.com', stage: 'won', contacts: [], activity: [], targetLanguages: [], interests: [], stageTimestamps: {}, handoffStatus: 'sent_to_ads_manager', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' } as any],
      deals: [{ id: 'deal-1', advertiserId: 'adv-1', proposalId: 'proposal-1', agreedValue: '10000', campaignObjective: 'Launch', campaignStart: '2026-08-01', campaignEnd: '2026-08-31', selectedInventory: ['HOME_728x90'], languages: ['English'], targetRegion: 'Gujarat', status: 'handoff_sent', handoffStatus: 'sent_to_ads_manager', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' } as any],
      handoffs: [{ id: 'handoff-1', advertiserId: 'adv-1', dealId: 'deal-1', proposalId: 'proposal-1', campaignName: 'Acme Launch', campaignObjective: 'Launch', campaignStart: '2026-08-01', campaignEnd: '2026-08-31', selectedAdProducts: ['HOME_728x90'], targetRegion: 'Gujarat', languages: ['English'], agreedCampaignValue: '10000', status: 'sent_to_ads_manager', sentAt: '2026-08-02T00:00:00.000Z', sentBy: 'Founder' } as any],
    };
    vi.mocked(getMarketingWorkspace).mockResolvedValue(workspace);

    render(<Marketing />);
    fireEvent.click(screen.getByRole('tab', { name: 'Performance' }));

    expect(await screen.findByRole('heading', { name: 'Marketing Performance' })).toBeInTheDocument();
    expect(screen.getByText('No fake campaign results are shown. Missing impressions, clicks, revenue or UTM attribution remain Not Connected until verified sources provide them.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create Report' }));

    await waitFor(() => expect(latestSavedWorkspace().campaignReports).toHaveLength(1));
    expect(latestSavedWorkspace().campaignReports[0].metrics).toMatchObject({ impressions: null, clicks: null, ctrPct: null, sourceStatus: 'Not Connected' });
    expect(window.localStorage.getItem('np_marketing_workspace_v2')).toBeNull();
  });

  it('creates Phase 4 renewal opportunities through the backend workspace API', async () => {
    const workspace: MarketingData = {
      ...createEmptyMarketingData(),
      advertisers: [{ id: 'adv-1', companyName: 'Acme Retail', industry: 'Retail', contactPerson: 'Nina', email: 'nina@example.com', stage: 'won', contacts: [], activity: [], targetLanguages: [], interests: [], stageTimestamps: {}, handoffStatus: 'sent_to_ads_manager', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' } as any],
      deals: [{ id: 'deal-1', advertiserId: 'adv-1', proposalId: 'proposal-1', agreedValue: '10000', campaignObjective: 'Launch', campaignStart: '2026-08-01', campaignEnd: '2026-08-31', selectedInventory: ['HOME_728x90'], languages: ['English'], targetRegion: 'Gujarat', salesOwnerId: 'founder', salesOwnerName: 'Founder', status: 'won', handoffStatus: 'sent_to_ads_manager', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' } as any],
    };
    vi.mocked(getMarketingWorkspace).mockResolvedValue(workspace);

    render(<Marketing />);
    fireEvent.click(screen.getByRole('tab', { name: 'Renewals' }));

    expect(await screen.findByRole('heading', { name: 'Renewals' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create Renewal' }));

    await waitFor(() => expect(latestSavedWorkspace().renewals).toHaveLength(1));
    expect(latestSavedWorkspace().renewals[0]).toMatchObject({ advertiserId: 'adv-1', previousDealId: 'deal-1', status: 'Upcoming' });
    expect(window.localStorage.getItem('np_marketing_workspace_v2')).toBeNull();
  });
});