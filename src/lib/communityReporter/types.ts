export interface CommunityReporterStory {
  id: string;
  headline: string;
  category: string;
  language?: string;
  city?: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  reporterEmail?: string;
  summary?: string | null;
}
