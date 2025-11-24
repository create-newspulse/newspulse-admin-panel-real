import { api } from './client';

export type CommunitySubmissionPriority =
  | 'FOUNDER_REVIEW'
  | 'EDITOR_REVIEW'
  | 'LOW_PRIORITY';

// Raw backend shape
export interface CommunitySubmissionApi {
  _id: string;
  userName?: string;
  email?: string;
  location?: string;
  category?: string;
  headline?: string;
  body?: string;
  mediaLink?: string;
  aiHeadline?: string;
  aiBody?: string;
  riskScore?: number;
  flags?: string[];
  rejectReason?: string;
  status?: string;
  priority?: CommunitySubmissionPriority;
  createdAt?: string;
  updatedAt?: string;
}

// Normalized UI shape
export interface CommunitySubmission extends CommunitySubmissionApi {
  id: string; // mapped from _id
}

function normalizeOne(item: CommunitySubmissionApi): CommunitySubmission {
  return { ...item, id: item._id };
}

function normalizeList(list: CommunitySubmissionApi[]): CommunitySubmission[] {
  return list.map(normalizeOne);
}

export async function listCommunitySubmissions(params: Record<string, any> = {}): Promise<CommunitySubmission[]> {
  const { data } = await api.get('/api/admin/community-reporter/submissions', { params });
  const raw = data?.submissions || data?.data?.submissions || Array.isArray(data) ? data : [];
  return normalizeList(raw as CommunitySubmissionApi[]);
}

export async function getCommunitySubmission(id: string): Promise<CommunitySubmission | null> {
  const { data } = await api.get(`/api/admin/community-reporter/submissions/${id}`);
  const item = (data?.submission ?? data) as CommunitySubmissionApi | undefined;
  return item ? normalizeOne(item) : null;
}

export async function updateCommunitySubmissionDecision(id: string, decision: 'approve' | 'reject', extra?: { aiHeadline?: string; aiBody?: string; rejectReason?: string }) {
  const { aiHeadline, aiBody, rejectReason } = extra || {};
  const { data } = await api.post(`/api/admin/community-reporter/submissions/${id}/decision`, { decision, aiHeadline, aiBody, rejectReason });
  return data;
}
