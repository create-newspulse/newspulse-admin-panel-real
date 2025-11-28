export type CommunitySubmissionStatus = 'pending' | 'approved' | 'rejected' | 'trash';

export interface CommunitySubmission {
  id: string;
  headline: string;
  body: string;
  category?: string;
  location?: string; // or city; keeping both optional
  city?: string;
  status: CommunitySubmissionStatus;
  priority?: 'FOUNDER_REVIEW' | 'EDITOR_REVIEW' | 'LOW_PRIORITY';
  linkedArticleId?: string | null;
  createdAt?: string;
  userName?: string; // reporter display name
  name?: string; // legacy field fallback
  email?: string;
  // --- Reporter enrichment (UI only) ---
  reporterName?: string; // normalized name (userName || name)
  reporterAge?: number; // if backend sends age or age numeric string
  reporterAgeGroup?: string; // if backend sends explicit ageGroup; else derived
  reporterLocation?: string; // combined city/state/country, or raw location
  // Allow other backend-provided fields without typing AI/risk ones
  [key: string]: any;
}
