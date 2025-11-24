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
  const { data } = await api.get('/api/admin/community-reporter/submissions', { params });
  return data;
}

export async function getCommunitySubmission(id: string) {
  const { data } = await api.get(`/api/admin/community-reporter/submissions/${id}`);
  return data;
}

export async function updateCommunitySubmissionStatus(id: string, body: { status: string; rejectReason?: string; aiHeadline?: string; aiBody?: string }) {
  // Backend now exposes decision endpoint; retain status patch if still supported, else fallback.
  try {
    const { data } = await api.patch(`/api/admin/community-reporter/submissions/${id}/status`, body);
    return data;
  } catch (e: any) {
    // Fallback to decision endpoint if status not found and we have a status value to map
    if (e?.response?.status === 404 && body.status) {
      const action = body.status.toLowerCase() === 'approved' ? 'approve' : body.status.toLowerCase() === 'rejected' ? 'reject' : undefined;
      if (action) {
        const { data } = await api.post(`/api/admin/community-reporter/submissions/${id}/decision`, { action, aiHeadline: body.aiHeadline, aiBody: body.aiBody, rejectReason: body.rejectReason });
        return data;
      }
    }
    throw e;
  }
}
