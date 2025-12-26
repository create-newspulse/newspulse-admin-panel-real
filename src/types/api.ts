// Shared API domain types for NewsPulse admin panel.
// Centralizing these reduces scattered 'any' usage and drift.

export type CommunitySubmissionPriority = 'FOUNDER_REVIEW' | 'EDITOR_REVIEW' | 'LOW_PRIORITY';

// Raw shape from backend (Mongo-style _id; backend may send varied optional fields)
export interface CommunitySubmissionApi {
  _id: string;
  userName?: string;
  name?: string;
  email?: string;
  location?: string;
  city?: string;
  category?: string;
  headline?: string;
  body?: string;
  mediaLink?: string;
  aiHeadline?: string;
  aiBody?: string;
  riskScore?: number;
  flags?: string[];
  rejectReason?: string;
  status?: string; // may be upper/lower case
  linkedArticleId?: string | null;
  priority?: CommunitySubmissionPriority;
  createdAt?: string;
  updatedAt?: string;
}

// Normalized UI type (stable id + normalized status lower-case)
export interface CommunitySubmission {
  id: string;
  userName?: string;
  name?: string;
  email?: string;
  location?: string;
  city?: string;
  category?: string;
  headline?: string;
  body?: string;
  mediaLink?: string;
  aiHeadline?: string;
  aiBody?: string;
  riskScore?: number;
  flags?: string[];
  rejectReason?: string;
  status?: string; // always lower-case for filtering
  linkedArticleId?: string | null;
  priority?: CommunitySubmissionPriority;
  createdAt?: string;
  updatedAt?: string;
}

export interface CommunityApproveResponse {
  ok: boolean;
  success?: boolean;
  submission: CommunitySubmissionApi | CommunitySubmission; // raw or already normalized
  draftArticle?: Article | null; // may be present when a draft is created
  article?: Article | null;      // or an existing article was linked
}

// Minimal Article shape (extend if needed). Mirrors typical backend payload fields used client-side.
export interface Article {
  _id: string;
  title?: string;
  slug?: string;
  summary?: string;
  content?: string; // aka body
  imageUrl?: string;
  category?: string;
  language?: string;
  status?: 'draft' | 'scheduled' | 'published' | 'archived' | 'deleted';
  scheduledAt?: string | null;
  publishAt?: string | null;
  tags?: string[];
  author?: { id?: string; name?: string } | null;
  ptiCompliance?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Editorial workflow checklist & state for news article lifecycle.
export interface WorkflowChecklist {
  ptiCompliance: boolean;
  rightsCleared: boolean;
  attributionPresent: boolean;
  defamationScanOk: boolean;
}

export type WorkflowStage = 'draft' | 'review' | 'legal' | 'approved' | 'scheduled' | string;

export interface WorkflowState {
  status: string;      // backend status (may mirror stage or final state)
  stage: WorkflowStage;
  checklist: WorkflowChecklist;
  approvals?: ApprovalRecord[]; // structured approvals
  scheduledAt?: string | null;
}

// Params used for managing & listing articles (ManageNews + ArticleFilters + ArticleTable)
export interface ManageNewsParams {
  status: 'all' | Article['status'];
  category?: string;
  language?: string;
  from?: string;        // ISO date (yyyy-mm-dd)
  to?: string;          // ISO date
  q?: string;           // search query
  page: number;
  limit: number;
  sort: string;         // backend sort expression e.g. -createdAt
}

export interface ApprovalRecord {
  id?: string;
  role: string;            // e.g. 'editor' | 'legal' | 'founder'
  userId?: string;
  userName?: string;
  at: string;              // ISO timestamp
  note?: string;
}

// Community reporter decision response (approve or reject)
export interface CommunityDecisionApprove {
  ok?: boolean; success?: boolean;
  submission: CommunitySubmissionApi | CommunitySubmission;
  draftArticle?: Article | null;
  article?: Article | null;
  action: 'approve';
}
export interface CommunityDecisionReject {
  ok?: boolean; success?: boolean;
  submission: CommunitySubmissionApi | CommunitySubmission;
  rejectReason?: string;
  action: 'reject';
}
export type CommunityDecisionResponse = CommunityDecisionApprove | CommunityDecisionReject;

// Bulk upload result shape
export interface BulkUploadResult {
  created: number;
  updated: number;
  skipped: number;
  errors?: { row: number; message: string }[];
}

// Generic API envelope used by some endpoints.
export interface ApiListEnvelope<T> {
  submissions?: T[]; // community reporter list
  data?: T[];        // articles list
  page?: number;
  pages?: number;
  total?: number;
}

// Standard error payload shape (union of common backend fields).
export interface ApiErrorPayload {
  message?: string;
  error?: string;
  code?: string;
  errorCode?: string;
  status?: number;
}

// Helper to normalize community submission raw -> UI type.
export function normalizeCommunitySubmission(raw: CommunitySubmissionApi): CommunitySubmission {
  return {
    ...raw,
    id: (raw as any).id || raw._id || (raw as any).ID || (raw as any).uuid || 'missing-id',
    status: (raw.status || '').toLowerCase(),
    linkedArticleId: (raw as any).linkedArticleId ?? null,
  };
}
