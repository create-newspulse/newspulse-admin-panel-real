export type ArticleStatus = 'draft' | 'scheduled' | 'published' | 'archived' | 'deleted';

export interface ArticleBasicMeta {
  _id: string;
  title: string;
  status: ArticleStatus;
  slug?: string;
  summary?: string;
  language?: string;
  category?: string;
  createdAt?: string;
  updatedAt?: string;
}
