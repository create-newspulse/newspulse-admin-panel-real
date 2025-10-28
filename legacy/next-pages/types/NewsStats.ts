export interface NewsStats {
  total: number;
  byCategory: { _id: string; count: number }[];
  byLanguage: { _id: string | null; count: number }[];
  recent: {
    _id: string;
    title: string;
    category: string;
    date: string;
  }[];
}
