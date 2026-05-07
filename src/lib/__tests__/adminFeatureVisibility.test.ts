import { describe, expect, it } from 'vitest';
import {
  createVisibilityPayload,
  normalizeAdminFeatureVisibility,
} from '@/lib/adminFeatureVisibility';

describe('adminFeatureVisibility contract', () => {
  it('reads only backend-approved keys from response.visibility', () => {
    const normalized = normalizeAdminFeatureVisibility({
      success: true,
      visibility: {
        addNews: false,
        manageNews: true,
        draftDesk: false,
        communityReporterQueue: true,
        reporterPortalAdmin: false,
        broadcastCenter: true,
        adsManager: false,
        media: true,
        viralVideos: false,
        aira: true,
        liveTv: false,
        editorial: true,
        seo: false,
        analytics: true,
        moderation: false,
        aiEngine: true,
        settings: false,
        dashboard: false,
        safeZone: false,
      },
    });

    expect(normalized.add).toBe(false);
    expect(normalized.manage).toBe(true);
    expect(normalized.drafts).toBe(false);
    expect(normalized['community-reporter-queue']).toBe(true);
    expect(normalized['reporter-portal']).toBe(false);
    expect(normalized['broadcast-center']).toBe(true);
    expect(normalized.ads).toBe(false);
    expect(normalized.media).toBe(true);
    expect(normalized['viral-videos']).toBe(false);
    expect(normalized.aira).toBe(true);
    expect(normalized.livetv).toBe(false);
    expect(normalized.editorial).toBe(true);
    expect(normalized.seo).toBe(false);
    expect(normalized.analytics).toBe(true);
    expect(normalized.moderation).toBe(false);
    expect(normalized['ai-engine']).toBe(true);
    expect(normalized.settings).toBe(false);
  });

  it('creates a wrapped PUT payload with only approved boolean keys', () => {
    const payload = createVisibilityPayload({
      add: false,
      manage: true,
      drafts: false,
      'community-reporter-queue': true,
      'reporter-portal': false,
      'broadcast-center': true,
      ads: false,
      media: true,
      'viral-videos': false,
      aira: true,
      livetv: false,
      editorial: true,
      seo: false,
      analytics: true,
      moderation: false,
      'ai-engine': true,
      settings: false,
    });

    expect(payload).toEqual({
      visibility: {
        addNews: false,
        manageNews: true,
        draftDesk: false,
        communityReporterQueue: true,
        reporterPortalAdmin: false,
        broadcastCenter: true,
        adsManager: false,
        media: true,
        viralVideos: false,
        aira: true,
        liveTv: false,
        editorial: true,
        seo: false,
        analytics: true,
        moderation: false,
        aiEngine: true,
        settings: false,
      },
    });
    expect((payload.visibility as Record<string, boolean>).dashboard).toBeUndefined();
    expect((payload.visibility as Record<string, boolean>).safeZone).toBeUndefined();
    expect((payload.visibility as Record<string, boolean>).dark).toBeUndefined();
    expect((payload.visibility as Record<string, boolean>).logout).toBeUndefined();
  });
});