import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  MARKETING_PRODUCT_OPTIONS,
  PROPOSAL_PRODUCT_OPTIONS,
  acceptProposalAndCreateDeal,
  archiveCampaignReport,
  archivePromotion,
  archiveRenewal,
  buildUtmUrl,
  calculateCtr,
  calculateGrowthGoalProgress,
  changeAdvertiserStage,
  changeCampaignReportStatus,
  changeRenewalStatus,
  createAdvertiserFromForm,
  createCampaignReport,
  createEmptyAdvertiserForm,
  createEmptyPerformanceMetrics,
  createGrowthGoal,
  createPerformanceSnapshot,
  createPromotion,
  createPromotionLink,
  createProposalDraftFromRenewal,
  createProposal,
  createRenewal,
  changePromotionStatus,
  filterAdvertisers,
  logPromotionChannelActivity,
  mapAdsManagerCampaignStatus,
  normalizeMarketingData,
  normalizePerformanceMetrics,
  normalizeUtmValue,
  proposalItemInventoryId,
  scheduleRenewalFollowUp,
  validateAdvertiserForm,
  type MarketingActor,
  type MarketingProposalItem,
} from '@/lib/marketing';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('marketing advertiser rules', () => {
  it('validates required advertiser fields and email format', () => {
    expect(validateAdvertiserForm(createEmptyAdvertiserForm())).toMatchObject({
      companyName: 'Company Name is required.',
      industry: 'Industry is required.',
      contactPerson: 'Contact Person is required.',
      email: 'Email is required.',
    });

    expect(validateAdvertiserForm({ ...createEmptyAdvertiserForm(), companyName: 'Acme', industry: 'Retail', contactPerson: 'Nina', email: 'bad-email' }).email)
      .toBe('Enter a valid email address.');
  });

  it('creates advertisers as New Lead with a stage timestamp and no sample data', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('advertiser-1');
    const advertiser = createAdvertiserFromForm({
      ...createEmptyAdvertiserForm(),
      companyName: 'Acme Retail',
      industry: 'Retail',
      contactPerson: 'Nina Shah',
      email: 'nina@example.com',
    }, '2026-08-10T10:00:00.000Z');

    expect(advertiser.stage).toBe('new_lead');
    expect(advertiser.stageTimestamps.new_lead).toBe('2026-08-10T10:00:00.000Z');
    expect(advertiser.companyName).toBe('Acme Retail');
    expect(JSON.stringify(advertiser)).not.toMatch(/50K|87%|500K|sample/i);
  });

  it('requires Lost Reason when moving a lead to Lost', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('advertiser-2');
    const advertiser = createAdvertiserFromForm({
      ...createEmptyAdvertiserForm(),
      companyName: 'Bright Foods',
      industry: 'Food',
      contactPerson: 'Raj Mehta',
      email: 'raj@example.com',
    }, '2026-08-10T10:00:00.000Z');

    expect(changeAdvertiserStage(advertiser, 'lost').error).toBe('Lost Reason is required when marking an advertiser as Lost.');
    const result = changeAdvertiserStage(advertiser, 'lost', { lostReason: 'Budget', now: '2026-08-10T11:00:00.000Z' });

    expect(result.advertiser?.stage).toBe('lost');
    expect(result.advertiser?.lostReason).toBe('Budget');
    expect(result.advertiser?.stageTimestamps.lost).toBe('2026-08-10T11:00:00.000Z');
  });

  it('filters advertisers by search and pipeline stage', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce('advertiser-3').mockReturnValueOnce('advertiser-4');
    const first = createAdvertiserFromForm({ ...createEmptyAdvertiserForm(), companyName: 'Metro Labs', industry: 'Health', contactPerson: 'Asha', email: 'asha@example.com' });
    const second = createAdvertiserFromForm({ ...createEmptyAdvertiserForm(), companyName: 'Surat Textiles', industry: 'Textiles', contactPerson: 'Hiren', email: 'hiren@example.com' });
    const won = changeAdvertiserStage(second, 'won').advertiser!;

    expect(filterAdvertisers([first, won], 'surat', 'all')).toEqual([won]);
    expect(filterAdvertisers([first, won], '', 'won')).toEqual([won]);
    expect(filterAdvertisers([first, won], 'surat', 'new_lead')).toEqual([]);
  });

  it('uses the real News Pulse proposal inventory and removes unsupported generic products', () => {
    expect(MARKETING_PRODUCT_OPTIONS.map((product) => product.label)).toEqual([
      'Home Banner 728×90',
      'Footer Banner 728×90',
      'Home Right Rail 300×250',
      'Home Left Rail 300×250',
      'Home Right Rail 300×600 (Half Page)',
      'Home Left Rail 300×600 (Half Page)',
      'Home Billboard 970×250 (Premium)',
      'Article Inline',
      'Article End',
      'Breaking Sponsor',
      'Live Update Sponsor',
      'Sponsored Feature',
      'Sponsored Article',
      'Combo Campaign',
      'Other / Custom Package',
    ]);
    expect(PROPOSAL_PRODUCT_OPTIONS).not.toContain('Section Sponsorship');
    expect(PROPOSAL_PRODUCT_OPTIONS).not.toContain('Video Advertisement');
    expect(MARKETING_PRODUCT_OPTIONS.find((product) => product.label === 'Home Right Rail 300×250')?.placementId).toBe('HOME_RIGHT_300x250');
    expect(MARKETING_PRODUCT_OPTIONS.find((product) => product.label === 'Breaking Sponsor')?.placementId).toBe('BREAKING_SPONSOR');
  });

  it('supports multiple proposal products and preserves Ads Manager placement identifiers for handoff', () => {
    const advertiser = createAdvertiserFromForm({ ...createEmptyAdvertiserForm(), companyName: 'Acme Retail', industry: 'Retail', contactPerson: 'Nina', email: 'nina@example.com' }, '2026-08-10T10:00:00.000Z');
    const items: MarketingProposalItem[] = [
      { id: 'item-1', product: 'Home Right Rail 300×250', productId: 'HOME_RIGHT_300x250', placementId: 'HOME_RIGHT_300x250', productGroup: 'DISPLAY ADVERTISING', description: 'Right rail placement', quantity: '30 days', listPrice: '', discount: '', finalPrice: '', notes: '' },
      { id: 'item-2', product: 'Breaking Sponsor', productId: 'BREAKING_SPONSOR', placementId: 'BREAKING_SPONSOR', productGroup: 'SPONSORSHIP', description: 'Breaking sponsor line', quantity: '7 days', listPrice: '', discount: '', finalPrice: '', notes: '' },
      { id: 'item-3', product: 'Sponsored Article', productId: 'SPONSORED_ARTICLE', productGroup: 'SPONSORED CONTENT', description: 'Sponsored article proposal', quantity: '1 article', listPrice: '', discount: '', finalPrice: '', notes: '' },
    ];
    const proposal = createProposal({ advertiserId: advertiser.id, title: 'Acme Campaign', campaignObjective: 'Launch', targetRegion: 'Gujarat', targetLanguages: ['English'], startDate: '2026-08-10', endDate: '2026-09-10', validUntil: '2026-08-20', items, taxRate: '0', approvalRequired: false }, []);

    expect(proposal.error).toBeUndefined();
    expect(proposal.proposal?.items).toHaveLength(3);
    expect(proposal.proposal?.items.map((item) => proposalItemInventoryId(item))).toEqual(['HOME_RIGHT_300x250', 'BREAKING_SPONSOR', 'SPONSORED_ARTICLE']);

    const accepted = acceptProposalAndCreateDeal(advertiser, proposal.proposal!, [], { name: 'Founder', staffId: 'founder', role: 'founder' }, '2026-08-10T11:00:00.000Z');
    expect(accepted.deal?.selectedInventory).toEqual(['HOME_RIGHT_300x250', 'BREAKING_SPONSOR', 'SPONSORED_ARTICLE']);
  });

  it('creates UTM links without breaking existing destination query parameters', () => {
    expect(normalizeUtmValue('Gujarati Growth Campaign')).toBe('Gujarati_Growth_Campaign');
    const result = buildUtmUrl('https://www.newspulse.co.in/gujarat?ref=home', {
      source: 'Instagram Organic',
      medium: 'social media',
      campaign: 'gujarati growth',
      content: 'hero card',
      term: '',
    });

    expect(result.error).toBeUndefined();
    expect(result.url).toContain('ref=home');
    expect(result.url).toContain('utm_source=Instagram_Organic');
    expect(result.url).toContain('utm_medium=social_media');
    expect(result.url).toContain('utm_campaign=gujarati_growth');
    expect(buildUtmUrl('https://example.com/story', { source: 'x', medium: 'social', campaign: 'test' }).error).toMatch(/approved News Pulse domain/);
  });

  it('creates promotions, multiple links, manual channel activity, and status history without advertiser campaign data', () => {
    const actor: MarketingActor = { name: 'Founder', staffId: 'founder', role: 'founder' };
    const created = createPromotion({
      campaignName: 'Gujarati Growth Campaign',
      objective: 'Grow Gujarati Audience',
      description: 'Internal audience growth campaign.',
      destinationType: 'Homepage',
      destinationUrl: 'https://www.newspulse.co.in/gu',
      primaryLanguage: 'Gujarati',
      targetRegion: 'Gujarat',
      channels: ['Instagram', 'WhatsApp'],
      startDate: '2026-08-10',
      endDate: '2026-08-20',
      ownerId: 'founder',
      ownerName: 'Founder',
      priority: 'High',
      notes: 'No automatic publishing.',
    }, actor, '2026-08-10T10:00:00.000Z');

    expect(created.error).toBeUndefined();
    expect(created.promotion?.status).toBe('Draft');
    const firstLink = createPromotionLink(created.promotion!, { channel: 'Instagram', source: 'instagram', medium: 'social', campaign: 'gujarati_growth', content: 'feed', destinationUrl: 'https://www.newspulse.co.in/gu' }, actor, '2026-08-10T10:05:00.000Z');
    const secondLink = createPromotionLink(firstLink.promotion!, { channel: 'WhatsApp', source: 'whatsapp', medium: 'messaging', campaign: 'gujarati_growth', content: 'community', destinationUrl: 'https://www.newspulse.co.in/gu' }, actor, '2026-08-10T10:06:00.000Z');
    const active = changePromotionStatus(secondLink.promotion!, 'Active', actor, '2026-08-10T11:00:00.000Z');
    const logged = logPromotionChannelActivity(active.promotion!, { channel: 'Instagram', activityType: 'Post Published', occurredAt: '2026-08-10T12:00:00.000Z', url: 'https://instagram.com/p/news', notes: 'Marked manually after external post.' }, actor, '2026-08-10T12:05:00.000Z');

    expect(secondLink.promotion?.links).toHaveLength(2);
    expect(active.error).toBeUndefined();
    expect(changePromotionStatus(active.promotion!, 'Active', actor).error).toBe('Promotion is already Active.');
    expect(logged.channelActivities[0].activityType).toBe('Post Published');
    expect(logged.activity[0].message).toBe('Marked as published externally: Post Published.');
    expect(JSON.stringify(logged)).not.toMatch(/advertiserId|selectedAdProducts/);
  });

  it('calculates growth goal progress only with verified current values and protects archive rights', () => {
    const founder: MarketingActor = { name: 'Founder', staffId: 'founder', role: 'founder' };
    const staff: MarketingActor = { name: 'Staff', staffId: 'staff-1', role: 'employee', specialRights: [] };
    const goal = createGrowthGoal({ goalName: 'Gujarati Readers', metric: 'Gujarati Readers', currentVerifiedValue: null, targetValue: 10000, startDate: '2026-08-01', targetDate: '2026-08-31', ownerId: 'founder', ownerName: 'Founder', status: 'Active', notes: '' }, founder);

    expect(goal.error).toBeUndefined();
    expect(calculateGrowthGoalProgress(goal.goal!)).toMatchObject({ current: null, progressPct: null, label: 'Cannot calculate' });
    expect(calculateGrowthGoalProgress({ ...goal.goal!, currentVerifiedValue: 2500 })).toMatchObject({ remaining: 7500, progressPct: 25 });

    const promotion = createPromotion({ campaignName: 'Archive Test', objective: 'Website Traffic', description: '', destinationType: 'Homepage', destinationUrl: 'https://www.newspulse.co.in/', primaryLanguage: 'All', targetRegion: 'India', channels: ['Organic / Internal Promotion'], startDate: '2026-08-10', endDate: '2026-08-11', ownerId: 'founder', ownerName: 'Founder', priority: 'Normal', notes: '' }, founder).promotion!;
    expect(archivePromotion(promotion, staff).error).toBe('Archive requires archive_promotion.');
    expect(archivePromotion(promotion, founder).promotion?.archivedAt).toBeTruthy();
  });

  it('normalizes legacy Phase 2 workspaces with Phase 3 collections and default presets', () => {
    const normalized = normalizeMarketingData({ advertisers: [], proposals: [] });

    expect(normalized.promotions).toEqual([]);
    expect(normalized.growthGoals).toEqual([]);
    expect(normalized.campaignReports).toEqual([]);
    expect(normalized.renewals).toEqual([]);
    expect(normalized.performanceSnapshots).toEqual([]);
    expect(normalized.contentQueue).toEqual([]);
    expect(normalized.utmPresets.map((preset) => preset.name)).toContain('Instagram Organic');
    expect(normalized.settings.useVerifiedAnalyticsOnly).toBe(true);
  });

  it('calculates Phase 4 campaign performance only from verified metric fields', () => {
    expect(calculateCtr(null, 10)).toBeNull();
    expect(calculateCtr(0, 10)).toBeNull();
    expect(calculateCtr(1000, 25)).toBe(2.5);
    expect(createEmptyPerformanceMetrics()).toMatchObject({ impressions: null, clicks: null, ctrPct: null, sourceStatus: 'Not Connected' });
    expect(normalizePerformanceMetrics({ impressions: 2000, clicks: 40, sourceStatus: 'Connected' })).toMatchObject({ impressions: 2000, clicks: 40, ctrPct: 2, sourceStatus: 'Connected' });
    expect(normalizePerformanceMetrics({ campaignNotes: '4000 impressions' } as any)).toMatchObject({ impressions: null, clicks: null, ctrPct: null });
    expect(mapAdsManagerCampaignStatus('running')).toBe('Active');
    expect(mapAdsManagerCampaignStatus('delivery_error')).toBe('Delivery Error');
    expect(mapAdsManagerCampaignStatus(undefined)).toBe('Not Connected');
  });

  it('creates advertiser campaign reports without inventing missing results', () => {
    const founder: MarketingActor = { name: 'Founder', staffId: 'founder', role: 'founder' };
    const staff: MarketingActor = { name: 'Reporter', staffId: 'staff-1', role: 'employee', specialRights: ['create_campaign_report'] };
    const advertiser = createAdvertiserFromForm({ ...createEmptyAdvertiserForm(), companyName: 'Acme Retail', industry: 'Retail', contactPerson: 'Nina', email: 'nina@example.com' }, '2026-08-10T10:00:00.000Z');
    const items: MarketingProposalItem[] = [{ id: 'item-1', product: 'Home Banner 728×90', productId: 'HOME_728x90', placementId: 'HOME_728x90', productGroup: 'DISPLAY ADVERTISING', description: 'Home banner', quantity: '30 days', listPrice: '10000', discount: '', finalPrice: '10000', notes: '' }];
    const proposal = createProposal({ advertiserId: advertiser.id, title: 'Acme Campaign', campaignObjective: 'Launch', targetRegion: 'Gujarat', targetLanguages: ['English'], startDate: '2026-08-10', endDate: '2026-09-10', validUntil: '2026-08-20', items, taxRate: '0', approvalRequired: false }, []).proposal!;
    const deal = acceptProposalAndCreateDeal(advertiser, proposal, [], founder, '2026-08-10T11:00:00.000Z').deal!;

    const report = createCampaignReport({ reportType: 'Advertiser Campaign', advertiserId: advertiser.id, deal, proposal, metrics: { impressions: 1000, clicks: 25, sourceStatus: 'Connected' }, campaignNotes: 'Client asked about reach.' }, staff, '2026-08-11T10:00:00.000Z').report!;

    expect(report.status).toBe('Draft');
    expect(report.metrics.ctrPct).toBe(2.5);
    expect(report.metrics.sourceStatus).toBe('Connected');
    expect(report.placements).toEqual(['HOME_728x90']);
    expect(report.campaignNotes).toBe('Client asked about reach.');

    const ready = changeCampaignReportStatus(report, 'Ready', staff, '2026-08-11T11:00:00.000Z').report!;
    const shared = changeCampaignReportStatus(ready, 'Shared', founder, '2026-08-12T11:00:00.000Z').report!;
    expect(shared.status).toBe('Shared');
    expect(shared.sharedBy).toBe('Founder');
    expect(changeCampaignReportStatus(ready, 'Shared', staff, '2026-08-12T11:00:00.000Z', { requireApproval: true }).error).toBe('Sharing requires an approved report when approval is enabled.');
    expect(archiveCampaignReport(shared, staff).error).toBe('Archiving campaign reports requires delete_campaign_report.');
    expect(archiveCampaignReport(shared, founder).report?.status).toBe('Archived');
  });

  it('manages renewals, follow-ups and safe previous-package proposal copies', () => {
    const founder: MarketingActor = { name: 'Founder', staffId: 'founder', role: 'founder' };
    const staff: MarketingActor = { name: 'Renewal Owner', staffId: 'staff-2', role: 'employee', specialRights: ['manage_renewals'] };
    const advertiser = createAdvertiserFromForm({ ...createEmptyAdvertiserForm(), companyName: 'Surat Textiles', industry: 'Textiles', contactPerson: 'Hiren', email: 'hiren@example.com' }, '2026-08-10T10:00:00.000Z');
    const items: MarketingProposalItem[] = [{ id: 'item-1', product: 'Breaking Sponsor', productId: 'BREAKING_SPONSOR', placementId: 'BREAKING_SPONSOR', productGroup: 'SPONSORSHIP', description: 'Breaking sponsor', quantity: '7 days', listPrice: '5000', discount: '10%', finalPrice: '4500', notes: 'Prior approval' }];
    const previousProposal = createProposal({ advertiserId: advertiser.id, title: 'Previous Campaign', campaignObjective: 'Awareness', targetRegion: 'Gujarat', targetLanguages: ['Gujarati'], startDate: '2026-08-10', endDate: '2026-08-20', validUntil: '2026-08-05', internalSalesOwnerId: 'staff-2', internalSalesOwnerName: 'Renewal Owner', items, taxRate: '0', approvalRequired: false }, []).proposal!;
    const deal = acceptProposalAndCreateDeal(advertiser, previousProposal, [], founder, '2026-08-10T11:00:00.000Z').deal!;
    const renewal = createRenewal({ advertiserId: advertiser.id, previousDeal: deal, previousProposal, previousCampaignId: 'ads-123', previousCampaignValue: '4500', campaignEndDate: '2026-08-20', suggestedFollowUpDate: '2026-08-25', ownerId: 'staff-2', ownerName: 'Renewal Owner' }, staff, '2026-08-21T10:00:00.000Z').renewal!;

    expect(renewal.status).toBe('Upcoming');
    expect(changeRenewalStatus(renewal, 'Interested', staff).renewal?.status).toBe('Interested');
    const followUp = scheduleRenewalFollowUp(advertiser, renewal, staff, '2026-08-21T11:00:00.000Z');
    expect(followUp.followUp.type).toBe('Renewal Discussion');
    expect(followUp.followUp.date).toBe('2026-08-25');

    const draft = createProposalDraftFromRenewal(renewal, previousProposal, true, [], '2026-08-22T10:00:00.000Z').proposal!;
    expect(draft.advertiserId).toBe(advertiser.id);
    expect(draft.items).toHaveLength(1);
    expect(draft.items[0]).toMatchObject({ productId: 'BREAKING_SPONSOR', placementId: 'BREAKING_SPONSOR', listPrice: '', discount: '', finalPrice: '', notes: '' });
    expect(draft.id).not.toBe(previousProposal.id);
    expect(draft.proposalId).not.toBe(previousProposal.proposalId);
    expect(draft.status).toBe('draft');

    expect(archiveRenewal(renewal, staff).error).toBe('Archiving renewal records requires delete_renewal_record.');
    expect(archiveRenewal(renewal, founder).renewal?.archivedAt).toBeTruthy();
  });

  it('stores verified growth snapshots without manual traffic substitution', () => {
    const founder: MarketingActor = { name: 'Founder', staffId: 'founder', role: 'founder' };
    const staff: MarketingActor = { name: 'Staff', staffId: 'staff-1', role: 'employee', specialRights: [] };

    expect(createPerformanceSnapshot({ recordType: 'Growth Goal', recordId: 'goal-1', metric: 'Monthly Website Users', source: 'Analytics', value: 1200 }, staff).error).toBe('Verified performance snapshots require view_growth_performance.');
    const snapshot = createPerformanceSnapshot({ recordType: 'Growth Goal', recordId: 'goal-1', metric: 'Monthly Website Users', source: 'Analytics', value: 1200 }, founder, '2026-08-12T10:00:00.000Z').snapshot!;
    expect(snapshot).toMatchObject({ recordType: 'Growth Goal', metric: 'Monthly Website Users', value: 1200, source: 'Analytics' });
    expect(createPerformanceSnapshot({ recordType: 'Growth Goal', recordId: 'goal-1', metric: 'Monthly Website Users', source: 'Manual note', value: Number.NaN }, founder).error).toBe('Snapshot value must be verified numeric data.');
  });
});