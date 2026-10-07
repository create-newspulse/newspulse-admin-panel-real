export const FAITH_CULTURE_TOPIC_OPTIONS = [
  { value: 'faith-spiritual-life', label: 'Faith & Spiritual Life' },
  { value: 'living-heritage', label: 'Living Heritage & Traditions' },
  { value: 'food-agricultural-heritage', label: 'Food & Agricultural Heritage' },
  { value: 'architecture-art-public-heritage', label: 'Architecture, Art & Public Heritage' },
  { value: 'community-social-traditions', label: 'Community & Social Traditions' },
  { value: 'folk-arts-festivals-textiles', label: 'Folk Arts, Festivals & Textiles' },
  { value: 'language-cultural-identity', label: 'Language & Cultural Identity' },
] as const;

export type FaithCultureTopic = typeof FAITH_CULTURE_TOPIC_OPTIONS[number]['value'];

export function isFaithCultureTopic(value: unknown): value is FaithCultureTopic {
  return FAITH_CULTURE_TOPIC_OPTIONS.some((option) => option.value === value);
}
