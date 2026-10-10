import { z } from 'zod';
import { adminApiClient } from '@/lib/adminApiClient';
import { normalizeError } from '@/lib/error';

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
