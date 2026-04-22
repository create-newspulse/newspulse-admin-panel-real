import { describe, expect, it } from 'vitest';

import {
  normalizeSponsoredContentPlacement,
  normalizeSponsoredFeatureRecord,
} from '../sponsoredContentInventory';

describe('sponsoredContentInventory', () => {
  it('normalizes Sponsored Feature records without any ad slot fields', () => {
    const record = normalizeSponsoredFeatureRecord({
      id: 'feature-1',
      placement: 'HOMEPAGE_SPONSORED_FEATURE',
      sponsorName: 'Acme',
      internalCampaignName: 'Launch',
      headline: 'Headline',
      shortSummary: 'Summary',
      ctaText: 'Read more',
      destinationUrl: 'https://example.com',
      coverImage: 'https://example.com/cover.jpg',
      isActive: true,
      slot: 'HOME_BILLBOARD_970x250',
      slotKey: 'HOME_BILLBOARD_970x250',
    });

    expect(record).toMatchObject({
      id: 'feature-1',
      type: 'sponsored_feature',
      placement: 'homepage_sponsored_feature',
      sponsorName: 'Acme',
      coverImage: 'https://example.com/cover.jpg',
      isActive: true,
    });
    expect(record).not.toHaveProperty('slot');
    expect(record).not.toHaveProperty('slotKey');
  });

  it('normalizes legacy placement variants to homepage_sponsored_feature', () => {
    expect(normalizeSponsoredContentPlacement('HOMEPAGE_SPONSORED_FEATURE')).toBe('homepage_sponsored_feature');
    expect(normalizeSponsoredContentPlacement('home_page_sponsored_feature')).toBe('homepage_sponsored_feature');
  });
});