import { z } from 'zod';
import { adminApiClient } from '@/lib/adminApiClient';
import { normalizeArticleError } from '@/lib/articleLifecycle';
import type { ManageNewsParams } from '@/types/api';

const countSchema = z.number().int().nonnegative().safe();
const logicalCountsSchema = z.object({
  unit: z.literal('logical-story'),
  total: countSchema,
  counts: z.object({
    published: countSchema,
    draft: countSchema,
    scheduled: countSchema,
    deleted: countSchema,
    archived: countSchema,
    mixed: countSchema,
  }),
}).refine(({ total, counts }) => Object.values(counts).reduce((sum, count) => sum + count, 0) === total);
const responseSchema = z.object({
  ok: z.literal(true),
  success: z.literal(true),
  data: logicalCountsSchema,
});

export type ArticleLogicalCounts = z.infer<typeof logicalCountsSchema>;
export type ArticleLogicalCountFilters = Partial<Pick<ManageNewsParams,
  'status' | 'category' | 'language' | 'from' | 'to' | 'q'
>>;

export async function getArticleLogicalCounts(
  filters: ArticleLogicalCountFilters = {},
  signal?: AbortSignal,
): Promise<ArticleLogicalCounts> {
  const { status, category, language, from, to, q } = filters;
  const response = await adminApiClient.get<unknown>('articles/counts', {
    params: { status: status === 'all' ? undefined : status, category, language, from, to, q },
    signal,
    headers: { 'Cache-Control': 'no-store' },
  });
  const parsed = responseSchema.safeParse(response.data);
  if (!parsed.success) {
    throw Object.assign(new Error('Logical story counts response could not be read. Please retry.'), {
      code: 'INVALID_ARTICLE_COUNTS_RESPONSE',
    });
  }
  return parsed.data.data;
}

export function normalizeArticleCountsError(error: unknown) {
  const failure = normalizeArticleError(error, 'Logical story counts unavailable');
  if (failure.status === 409 && failure.code === 'ARTICLE_LOGICAL_IDENTITY_CONFLICT') {
    failure.message = 'Logical story counts are unavailable because article identities conflict. Resolve the identity conflict and retry.';
  } else if (failure.code === 'INVALID_ARTICLE_COUNTS_RESPONSE') {
    failure.message = 'Logical story counts response could not be read. Please retry.';
  }
  return failure;
}
