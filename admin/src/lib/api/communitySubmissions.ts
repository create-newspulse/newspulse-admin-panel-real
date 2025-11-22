import { api } from './client';

export interface CommunitySubmission {
  _id: string;
  headline?: string;
  name?: string;
  email?: string;
  location?: string;
  category?: string;
  status?: string; // NEW | APPROVED | REJECTED
  body?: string;
  rejectReason?: string;
  createdAt?: string;
}

export async function listCommunitySubmissions(params: Record<string, any> = {}) {
  const { data } = await api.get('/api/admin/community/submissions', { params });
  return data;
}

export async function getCommunitySubmission(id: string) {
  const { data } = await api.get(`/api/admin/community/submissions/${id}`);
  return data;
}

export async function updateCommunitySubmissionStatus(id: string, body: { status: string; rejectReason?: string }) {
  const { data } = await api.patch(`/api/admin/community/submissions/${id}/status`, body);
  return data;
}
