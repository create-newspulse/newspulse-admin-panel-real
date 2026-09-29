import { z } from 'zod';
import { adminApiClient } from '@/lib/adminApiClient';

const CURATION_PATH = 'admin/pulse-dialogue/curation';
export const CURATION_LIMIT = 6;
const idSchema = z.string().regex(/^[a-f\d]{24}$/i);
const dialogueSchema = z.object({
  id: idSchema,
  title: z.string().nullable(),
  slug: z.string().nullable(),
  status: z.string().nullable(),
  missing: z.boolean(),
});
const voiceSchema = z.object({
  id: idSchema,
  slug: z.string().nullable(),
  name: z.string().nullable(),
  publicDesignation: z.string().nullable().optional(),
  photoUrl: z.string().nullable().optional(),
  shortBio: z.string().nullable().optional(),
  status: z.string().nullable(),
  profileVisible: z.boolean(),
  missing: z.boolean(),
});
const responseSchema = z.object({
  ok: z.literal(true),
  configuration: z.object({
    featuredDialogue: z.array(dialogueSchema),
    featuredVoices: z.array(voiceSchema),
    updatedAt: z.string().nullable(),
  }),
});
const selectionSchema = z.array(idSchema).max(CURATION_LIMIT).refine(
  (ids) => new Set(ids).size === ids.length,
  'Duplicate selections are not allowed',
);

export type FeaturedDialogue = z.infer<typeof dialogueSchema>;
export type FeaturedVoice = z.infer<typeof voiceSchema>;
export type PulseDialogueCuration = z.infer<typeof responseSchema>['configuration'];

function parseConfiguration(data: unknown): PulseDialogueCuration {
  const parsed = responseSchema.safeParse(data);
  if (!parsed.success) throw new Error('Curation response could not be read. Please retry.');
  return parsed.data.configuration;
}

export async function getPulseDialogueCuration(): Promise<PulseDialogueCuration> {
  const response = await adminApiClient.get(CURATION_PATH, { headers: { 'Cache-Control': 'no-store' } });
  return parseConfiguration(response.data);
}

export async function saveFeaturedDialogue(articleIds: string[]): Promise<PulseDialogueCuration> {
  selectionSchema.parse(articleIds);
  const response = await adminApiClient.put(`${CURATION_PATH}/featured-dialogue`, { articleIds });
  return parseConfiguration(response.data);
}

export async function saveFeaturedVoices(contributorIds: string[]): Promise<PulseDialogueCuration> {
  selectionSchema.parse(contributorIds);
  const response = await adminApiClient.put(`${CURATION_PATH}/featured-voices`, { contributorIds });
  return parseConfiguration(response.data);
}