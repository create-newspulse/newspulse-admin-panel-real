import { api } from './client';

export interface CommunitySubmission {
  _id: string;
  userName: string;
  email: string;
  location?: string;
  category?: string;
  headline: string;
  body: string;
  mediaLink?: string;
  aiHeadline?: string;
  aiBody?: string;
  riskScore?: number; // 0-100
  flags?: string[]; // e.g. ["mentions_minor", "needs_verification"]
  rejectReason?: string;
  status: 'NEW' | 'AI_REVIEWED' | 'PENDING_FOUNDER' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  updatedAt: string;
}

export async function listCommunitySubmissions(params: Record<string, any> = {}) {
  const { data } = await api.get('/api/admin/community/submissions', { params });
  return data;
}

export async function getCommunitySubmission(id: string) {
  const { data } = await api.get(`/api/admin/community/submissions/${id}`);
  return data;
}

export async function updateCommunitySubmissionStatus(id: string, body: { status: string; rejectReason?: string; aiHeadline?: string; aiBody?: string }) {
  // Prefer decision endpoint; maps status to uppercase decision.
  const decision = body.status?.toUpperCase();
  if (decision === 'APPROVED' || decision === 'REJECTED') {
    const { data } = await api.post(`/api/admin/community/submissions/${id}/decision`, { decision, aiHeadline: body.aiHeadline, aiBody: body.aiBody, rejectReason: body.rejectReason });
    return data;
  }
  // Fallback to legacy status patch if needed
  const { data } = await api.patch(`/api/admin/community/submissions/${id}/status`, body);
  return data;
}
