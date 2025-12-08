export type CommunitySubmissionStatus = 'pending' | 'approved' | 'rejected' | 'trash';

export interface CommunitySubmission {
  id: string;
  headline: string;
  body: string;
  category?: string;
  location?: string; // or city; keeping both optional
  city?: string;
  state?: string;
  country?: string;
  district?: string;
  status: CommunitySubmissionStatus;
  priority?: 'FOUNDER_REVIEW' | 'EDITOR_REVIEW' | 'LOW_PRIORITY';
  linkedArticleId?: string | null;
  createdAt?: string;
  userName?: string; // reporter display name
  name?: string; // legacy field fallback
  email?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactMethod?: 'email' | 'phone' | 'whatsapp' | 'other' | '' | undefined;
  contactOk?: boolean;
  futureContactOk?: boolean;
  // --- Reporter enrichment (UI only) ---
  reporterName?: string; // normalized name (userName || name)
  reporterAge?: number; // if backend sends age or age numeric string
  reporterAgeGroup?: string; // if backend sends explicit ageGroup; else derived
  reporterLocation?: string; // combined city/state/country, or raw location
  // --- AI review & highlighting ---
  aiTitle?: string | null;
  aiBody?: string | null;
  riskScore?: number; // 0-100 risk score from AI pipeline
  flags?: string[]; // machine readable flag tokens
  aiHighlighted?: boolean; // AI pick highlight bool
  aiTrendingScore?: number; // optional trending score numeric (higher = more trending)
  // --- Compliance / trust metrics (future-facing) ---
  ptiComplianceStatus?: string; // e.g. 'pass' | 'fail' | 'needs_review'
  trustScore?: number; // 0-100 internal trust / source reliability score
  // Allow other backend-provided fields without typing AI/risk ones
  [key: string]: any;
}
