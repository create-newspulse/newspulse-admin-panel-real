import { describe, expect, it } from 'vitest';

import { formatLocation, isEditorialCategoryDraft, isYouthPulseDraft } from '../DraftDeskPage';

describe('DraftDeskPage helpers', () => {
  it('matches Youth Pulse drafts from explicit handoff fields', () => {
    expect(isYouthPulseDraft({
      _id: '1',
      title: 'Youth draft',
      status: 'draft',
      sourceType: 'youth_pulse',
    } as any)).toBe(true);

    expect(isYouthPulseDraft({
      _id: '2',
      title: 'Youth draft',
      status: 'draft',
      sourceLabel: 'Youth Pulse',
    } as any)).toBe(true);

    expect(isYouthPulseDraft({
      _id: '3',
      title: 'Youth draft',
      status: 'draft',
      submissionSource: 'youth_pulse',
    } as any)).toBe(true);

    expect(isYouthPulseDraft({
      _id: '4',
      title: 'Youth draft',
      status: 'draft',
      category: 'youth-pulse',
    } as any)).toBe(true);

    expect(isYouthPulseDraft({
      _id: '5',
      title: 'Youth draft',
      status: 'draft',
      metadata: { youthPulseTrack: 'campus-buzz' },
    } as any)).toBe(true);
  });

  it('does not render empty location objects as raw JSON', () => {
    expect(formatLocation({
      state: null,
      stateSlug: null,
      city: null,
      citySlug: null,
      district: null,
      districtSlug: null,
      isUT: null,
      country: null,
    })).toBeNull();
  });

  it('matches only draft articles in the Editorial category', () => {
    expect(isEditorialCategoryDraft({
      _id: 'editorial-1',
      title: 'Editorial draft',
      status: 'draft',
      category: 'editorial',
    } as any)).toBe(true);

    expect(isEditorialCategoryDraft({
      _id: 'editorial-2',
      title: 'Editorial draft object category',
      status: 'draft',
      category: { slug: 'editorial' },
    } as any)).toBe(true);

    expect(isEditorialCategoryDraft({
      _id: 'published-editorial',
      title: 'Published editorial',
      status: 'published',
      category: 'editorial',
    } as any)).toBe(false);

    expect(isEditorialCategoryDraft({
      _id: 'regular-draft',
      title: 'Regular draft',
      status: 'draft',
      category: 'business',
    } as any)).toBe(false);
  });
});