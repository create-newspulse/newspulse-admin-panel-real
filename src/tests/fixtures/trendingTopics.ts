import type { AvailableTopic, TopicMembershipResponse, TopicStory } from '@/lib/api/trendingTopics';

export const syntheticId = (value: number) => String(value).padStart(24, '0');
export const TOPIC_ID = syntheticId(101);
export const OTHER_TOPIC_ID = syntheticId(102);
export const STORY_ID = syntheticId(201);
export const HINDI_ID = syntheticId(202);
export const GUJARATI_ID = syntheticId(203);

export function availableTopic(overrides: Partial<AvailableTopic> = {}): AvailableTopic {
  return {
    id: TOPIC_ID,
    title: 'Navratri 2026',
    slug: 'navratri-2026',
    name: { gu: 'Navratri 2026', hi: 'Navratri 2026', en: 'Navratri 2026' },
    active: true,
    promotionState: 'active',
    startsAt: '2026-10-01T00:00:00.000Z',
    expiresAt: '2026-10-31T00:00:00.000Z',
    articleTags: ['topic:navratri-2026'],
    membershipTag: 'topic:navratri-2026',
    assignmentSupported: true,
    ...overrides,
  };
}

export function otherTopic(overrides: Partial<AvailableTopic> = {}): AvailableTopic {
  return availableTopic({
    id: OTHER_TOPIC_ID, title: 'Gujarat Festivals', slug: 'gujarat-festivals',
    name: { gu: 'Gujarat Festivals', hi: 'Gujarat Festivals', en: 'Gujarat Festivals' },
    articleTags: ['topic:gujarat-festivals'], membershipTag: 'topic:gujarat-festivals',
    ...overrides,
  });
}

export function topicStory(overrides: Partial<TopicStory> = {}): TopicStory {
  return {
    logicalStoryId: STORY_ID,
    articleId: GUJARATI_ID,
    variantIds: [STORY_ID, HINDI_ID, GUJARATI_ID],
    translationGroupId: 'festival-logical-group',
    translationKey: 'festival-logical-group',
    title: 'Festival report',
    slug: 'festival-report',
    category: 'regional',
    status: 'published',
    publishedAt: '2026-10-01T08:00:00.000Z',
    availableLanguages: ['en', 'hi', 'gu'],
    pinned: false,
    attached: true,
    membershipConsistent: true,
    ...overrides,
  };
}

export function pageResult<T>(items: T[], options: { page?: number; limit?: number; total?: number } = {}) {
  const page = options.page ?? 1;
  const limit = options.limit ?? 20;
  const total = options.total ?? items.length;
  return {
    ok: true as const, items, total, count: items.length, page, limit,
    totalPages: Math.ceil(total / limit), hasNextPage: page < Math.ceil(total / limit),
  };
}

export function membershipResult(action: 'attach' | 'detach' = 'attach', overrides: Partial<TopicMembershipResponse> = {}): TopicMembershipResponse {
  return {
    ok: true, committed: true, unit: 'logical-story', topicId: TOPIC_ID,
    action, count: 1, changedVariants: 3,
    items: [topicStory({ attached: action === 'attach' })],
    ...overrides,
  };
}
