import { z } from 'zod';
import type { QueryClient } from '@tanstack/react-query';
import { adminApiClient } from '@/lib/adminApiClient';
import { normalizeError } from '@/lib/error';
import { refreshArticleQueries } from '@/lib/articleLifecycle';

const TOPICS_PATH = 'admin/topics';
const idSchema = z.string().regex(/^[a-f\d]{24}$/i);
const dateSchema = z.string().datetime({ offset: true });
const localizedTextSchema = z.object({
  gu: z.string().trim().min(1).max(160),
  hi: z.string().trim().min(1).max(160),
  en: z.string().trim().min(1).max(160),
});
const descriptionSchema = z.object({
  gu: z.string().trim().max(1000),
  hi: z.string().trim().max(1000),
  en: z.string().trim().max(1000),
});
const articleTagsSchema = z.array(
  z.string().trim().min(1).max(120).regex(/^[^\u0000-\u001f\u007f*]+$/),
).min(1).max(20).transform((tags) => [...new Set(tags)]);
const editableFields = {
  name: localizedTextSchema.strict(),
  description: descriptionSchema.partial().strict(),
  active: z.boolean(),
  order: z.number().int().safe(),
  startsAt: dateSchema,
  expiresAt: dateSchema.nullable(),
  articleTags: articleTagsSchema,
  pinnedArticleId: idSchema.nullable(),
};
const createSchema = z.object({
  ...editableFields,
  slug: z.string().trim().min(1).max(140),
  description: editableFields.description.optional(),
  active: editableFields.active.default(false),
  order: editableFields.order.default(0),
  expiresAt: editableFields.expiresAt.default(null),
  pinnedArticleId: editableFields.pinnedArticleId.default(null),
}).strict();
const updateSchema = z.object({
  ...editableFields,
  name: localizedTextSchema.partial().strict(),
}).partial().strict().refine((payload) => Object.keys(payload).length > 0);
const topicSchema = z.object({
  id: idSchema,
  slug: z.string().min(1),
  name: localizedTextSchema,
  description: descriptionSchema,
  active: z.boolean(),
  order: z.number().int().safe(),
  startsAt: dateSchema,
  expiresAt: dateSchema.nullable(),
  articleTags: articleTagsSchema,
  pinnedArticleId: idSchema.nullable(),
  createdAt: dateSchema.optional(),
  updatedAt: dateSchema.optional(),
});
const topicResponseSchema = z.object({ ok: z.literal(true), topic: topicSchema });
const listResponseSchema = z.object({
  ok: z.literal(true),
  items: z.array(topicSchema),
  total: z.number().int().nonnegative(),
  count: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
  hasNextPage: z.boolean(),
});
const listParamsSchema = z.object({
  active: z.enum(['all', 'true', 'false']).optional(),
  page: z.number().int().min(1).max(10000).optional(),
  limit: z.number().int().min(1).max(100).optional(),
}).strict();

export type LocalizedText = z.infer<typeof localizedTextSchema>;
export type EditorialTopic = z.infer<typeof topicSchema>;
export type EditorialTopicListResponse = z.infer<typeof listResponseSchema>;
export type CreateEditorialTopicPayload = z.input<typeof createSchema>;
export type UpdateEditorialTopicPayload = z.input<typeof updateSchema>;

export async function listTopics(params: z.infer<typeof listParamsSchema> = {}): Promise<EditorialTopicListResponse> {
  const response = await adminApiClient.get(TOPICS_PATH, {
    params: listParamsSchema.parse(params),
    headers: { 'Cache-Control': 'no-store' },
  });
  return listResponseSchema.parse(response.data);
}

export async function getTopic(id: string): Promise<EditorialTopic> {
  const response = await adminApiClient.get(`${TOPICS_PATH}/${idSchema.parse(id)}`, {
    headers: { 'Cache-Control': 'no-store' },
  });
  return topicResponseSchema.parse(response.data).topic;
}

export async function createTopic(payload: CreateEditorialTopicPayload): Promise<EditorialTopic> {
  const response = await adminApiClient.post(TOPICS_PATH, createSchema.parse(payload));
  return topicResponseSchema.parse(response.data).topic;
}

export async function updateTopic(id: string, payload: UpdateEditorialTopicPayload): Promise<EditorialTopic> {
  const response = await adminApiClient.patch(`${TOPICS_PATH}/${idSchema.parse(id)}`, updateSchema.parse(payload));
  return topicResponseSchema.parse(response.data).topic;
}

const languageSchema = z.enum(['gu', 'hi', 'en']);
const paginationFields = {
  total: z.number().int().nonnegative(),
  count: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().min(1).max(100),
  totalPages: z.number().int().nonnegative(),
  hasNextPage: z.boolean(),
};
const availableTopicSchema = z.object({
  id: idSchema,
  title: z.string().min(1),
  slug: z.string().min(1),
  name: localizedTextSchema,
  active: z.boolean(),
  promotionState: z.enum(['inactive', 'upcoming', 'archived', 'active']),
  startsAt: dateSchema,
  expiresAt: dateSchema.nullable(),
  articleTags: articleTagsSchema,
  membershipTag: z.string().nullable(),
  assignmentSupported: z.boolean(),
  attached: z.boolean().optional(),
  membershipConsistent: z.boolean().optional(),
});
const availableResponseSchema = z.object({
  ok: z.literal(true),
  lang: languageSchema,
  logicalStoryId: idSchema.optional(),
  items: z.array(availableTopicSchema),
  ...paginationFields,
});
const storySchema = z.object({
  logicalStoryId: idSchema,
  articleId: idSchema,
  variantIds: z.array(idSchema).min(1),
  translationGroupId: z.string().nullable(),
  translationKey: z.string().nullable(),
  title: z.string(),
  slug: z.string().nullable(),
  category: z.string().optional(),
  status: z.string().min(1),
  publishedAt: dateSchema.nullable(),
  availableLanguages: z.array(languageSchema),
  pinned: z.boolean(),
  attached: z.boolean(),
  membershipConsistent: z.boolean(),
  matchReasons: z.array(z.object({ field: z.string().min(1), term: z.string().min(1) })).optional(),
});
const storiesResponseSchema = z.object({
  ok: z.literal(true),
  unit: z.literal('logical-story'),
  lang: languageSchema,
  topicId: idSchema,
  items: z.array(storySchema),
  ...paginationFields,
});
const candidatesResponseSchema = storiesResponseSchema.extend({
  suggestionOnly: z.literal(true),
  terms: z.array(z.string()),
});
const storyParamsSchema = z.object({
  lang: languageSchema,
  page: z.number().int().min(1).max(10000).optional(),
  limit: z.number().int().min(1).max(100).optional(),
}).strict();
const searchQuerySchema = z.string().trim().min(2).max(120).regex(/^[^\u0000-\u001f\u007f]+$/);
const selectionSchema = z.object({ storyIds: z.array(idSchema.toLowerCase()).min(1).max(50) }).strict();
const membershipResponseSchema = z.object({
  ok: z.literal(true),
  committed: z.literal(true),
  unit: z.literal('logical-story'),
  topicId: idSchema,
  action: z.enum(['attach', 'detach']),
  count: z.number().int().min(1).max(50),
  changedVariants: z.number().int().nonnegative(),
  items: z.array(storySchema).min(1).max(50),
  revalidation: z.object({ ok: z.boolean(), code: z.string().optional() }).passthrough().optional(),
  postCommitWarnings: z.array(z.object({ code: z.string(), message: z.string().optional() })).optional(),
});

export type TopicLanguage = z.infer<typeof languageSchema>;
export type AvailableTopic = z.infer<typeof availableTopicSchema>;
export type AvailableTopicsResponse = z.infer<typeof availableResponseSchema>;
export type TopicStory = z.infer<typeof storySchema>;
export type TopicStoriesResponse = z.infer<typeof storiesResponseSchema>;
export type TopicCandidatesResponse = z.infer<typeof candidatesResponseSchema>;
export type TopicMembershipResponse = z.infer<typeof membershipResponseSchema>;
export type TopicStoryParams = z.infer<typeof storyParamsSchema>;
export type AvailableTopicsParams = TopicStoryParams & { active?: 'all' | 'true' | 'false'; storyId?: string };
export type AvailableTopicCollection = { items: AvailableTopic[]; logicalStoryId?: string };

function validatePage<T extends { items: unknown[] } & z.infer<z.ZodObject<typeof paginationFields>>>(page: T): T {
  if (page.count !== page.items.length || page.count > page.limit
    || page.totalPages !== Math.ceil(page.total / page.limit)
    || page.hasNextPage !== (page.page < page.totalPages)) {
    throw new Error('Invalid Trending Topics pagination');
  }
  return page;
}

export async function listAvailableTopics(params: AvailableTopicsParams): Promise<AvailableTopicsResponse> {
  const parsed = storyParamsSchema.extend({
    active: z.enum(['all', 'true', 'false']).optional(),
    storyId: idSchema.optional(),
  }).parse(params);
  const response = await adminApiClient.get(`${TOPICS_PATH}/available`, {
    params: parsed, headers: { 'Cache-Control': 'no-store' },
  });
  const result = validatePage(availableResponseSchema.parse(response.data));
  if (parsed.storyId) {
    idSchema.parse(result.logicalStoryId);
    for (const topic of result.items) {
      z.object({ attached: z.boolean(), membershipConsistent: z.boolean() }).parse(topic);
    }
  }
  return result;
}

export async function loadAvailableTopics(params: Pick<AvailableTopicsParams, 'lang' | 'storyId'>): Promise<AvailableTopicCollection> {
  const first = await listAvailableTopics({ ...params, active: 'all', page: 1, limit: 100 });
  const items = [...first.items];
  for (let page = 2; page <= first.totalPages; page += 1) {
    const next = await listAvailableTopics({ ...params, active: 'all', page, limit: 100 });
    if (next.page !== page || next.total !== first.total || next.logicalStoryId !== first.logicalStoryId) {
      throw new Error('Trending Topics changed during loading. Reload the topics.');
    }
    items.push(...next.items);
  }
  if (items.length !== first.total || new Set(items.map((topic) => topic.id)).size !== items.length) {
    throw new Error('The complete Trending Topics list could not be loaded.');
  }
  return { items, logicalStoryId: first.logicalStoryId };
}

export async function listTopicStories(id: string, params: TopicStoryParams): Promise<TopicStoriesResponse> {
  const response = await adminApiClient.get(`${TOPICS_PATH}/${idSchema.parse(id)}/stories`, {
    params: storyParamsSchema.parse(params), headers: { 'Cache-Control': 'no-store' },
  });
  return validatePage(storiesResponseSchema.parse(response.data));
}

export async function searchTopicStories(id: string, params: TopicStoryParams & { q: string }): Promise<TopicStoriesResponse> {
  const response = await adminApiClient.get(`${TOPICS_PATH}/${idSchema.parse(id)}/stories/search`, {
    params: storyParamsSchema.extend({ q: searchQuerySchema }).parse(params),
    headers: { 'Cache-Control': 'no-store' },
  });
  return validatePage(storiesResponseSchema.extend({ q: searchQuerySchema }).parse(response.data));
}

export async function listTopicCandidates(id: string, params: TopicStoryParams & { q?: string }): Promise<TopicCandidatesResponse> {
  const response = await adminApiClient.get(`${TOPICS_PATH}/${idSchema.parse(id)}/candidates`, {
    params: storyParamsSchema.extend({ q: searchQuerySchema.optional() }).parse(params),
    headers: { 'Cache-Control': 'no-store' },
  });
  return validatePage(candidatesResponseSchema.parse(response.data));
}

async function changeTopicMembership(id: string, storyIds: string[], action: 'attach' | 'detach'): Promise<TopicMembershipResponse> {
  const topicId = idSchema.parse(id).toLowerCase();
  const body = selectionSchema.parse({ storyIds });
  const response = await adminApiClient.post(`${TOPICS_PATH}/${topicId}/stories/${action}`, body);
  const result = membershipResponseSchema.parse(response.data);
  if (result.topicId !== topicId || result.action !== action || result.count !== result.items.length
    || result.items.some((story) => story.attached !== (action === 'attach') || !story.membershipConsistent)
    || body.storyIds.some((storyId) => !result.items.some((story) => story.variantIds.includes(storyId) || story.logicalStoryId === storyId))) {
    throw new Error('The Backend did not confirm the requested topic membership change.');
  }
  return result;
}

export const attachTopicStories = (id: string, storyIds: string[]) => changeTopicMembership(id, storyIds, 'attach');
export const detachTopicStories = (id: string, storyIds: string[]) => changeTopicMembership(id, storyIds, 'detach');

export async function refreshTopicMembershipQueries(client: QueryClient): Promise<void> {
  await client.cancelQueries({ queryKey: ['trending-topics'] });
  await Promise.all([
    client.invalidateQueries({ queryKey: ['trending-topics'] }, { throwOnError: true }),
    refreshArticleQueries(client),
  ]);
}

export function topicStoryErrorMessage(error: unknown): string {
  const failure = normalizeError(error, 'Trending Topic stories could not be loaded or changed. Please refresh and retry.');
  if (failure.code === 'UNSAFE_TOPIC_TAGS') {
    return 'The Backend refused this change because the topic uses shared or ordinary tags (UNSAFE_TOPIC_TAGS). This request did not change membership. Founder review is required.';
  }
  if (failure.status === 403 && failure.code === 'FOUNDER_REQUIRED') return 'Access Denied. Founder permission is required.';
  if (failure.status === 409) return 'Topic or story membership changed. Reload and review it before trying again.';
  if (failure.status === 400) return 'Check the topic, CMS News selection, and search text (2-120 characters).';
  if (failure.status === 404) return 'The topic or CMS News story was not found. Reload before trying again.';
  if (error instanceof z.ZodError) return 'The Backend returned invalid Trending Topic story data. No success could be confirmed. Reload and review the saved state.';
  return failure.message;
}

export function topicErrorMessage(error: unknown): string {
  if (error instanceof z.ZodError) return 'Topic data is invalid. Check the fields or retry loading.';
  const normalized = normalizeError(error, 'Trending Topics could not be loaded or saved. Please retry.');
  switch (normalized.status) {
    case 400: return 'Check the topic fields. A pinned story must be publicly eligible CMS News with a configured article tag.';
    case 404: return 'Topic not found. Reload the list and try again.';
    case 409: return normalized.code === 'SLUG_CONFLICT'
      ? 'This canonical slug already exists. Choose another slug.'
      : 'This topic has changed. Reopen it to load the latest version before saving.';
    case 503: return 'Trending Topics are temporarily unavailable. Please retry.';
    case 500: return 'Unable to process Trending Topics. Please retry.';
    default: return normalized.message;
  }
}
