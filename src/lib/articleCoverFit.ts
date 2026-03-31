export type ArticleCoverFit = 'photo' | 'graphic';

export const ARTICLE_COVER_FIT_OPTIONS: Array<{
  value: ArticleCoverFit;
  label: string;
  description: string;
}> = [
  {
    value: 'photo',
    label: 'Photo cover',
    description: 'Fills the hero area with a clean crop for standard photography.',
  },
  {
    value: 'graphic',
    label: 'Graphic/Infographic cover',
    description: 'Keeps the full graphic readable for text-heavy artwork and infographics.',
  },
];

export function normalizeArticleCoverFit(input: unknown): ArticleCoverFit {
  const value = String(input || '').trim().toLowerCase();
  if (value === 'graphic' || value === 'infographic' || value === 'contain') return 'graphic';
  return 'photo';
}

export function getArticleCoverFrameClass(input: unknown): string {
  return normalizeArticleCoverFit(input) === 'graphic'
    ? 'w-full aspect-video rounded-lg border border-slate-200 bg-white overflow-hidden'
    : 'w-full aspect-video rounded-lg border border-slate-200 bg-slate-50 overflow-hidden';
}

export function getArticleCoverImageClass(input: unknown): string {
  return normalizeArticleCoverFit(input) === 'graphic'
    ? 'w-full h-full object-contain p-3 sm:p-4 bg-white'
    : 'w-full h-full object-cover';
}