import adminApi from '@/api/adminApi';

export type VerificationLevel = 'unverified' | 'pending' | 'verified';
export type ReporterType = 'journalist' | 'community';

export interface JournalistApplication {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  city?: string;
  state?: string;
  country?: string;
  reporterType: ReporterType;
  verificationLevel: VerificationLevel;
  organisationName?: string;
  organisationType?: string;
  positionTitle?: string;
  beatsProfessional?: string[];
  yearsExperience?: number;
  languages?: string[];
  websiteOrPortfolio?: string;
  socialLinks?: { linkedin?: string; twitter?: string };
  storyCount?: number;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
}

export interface JournalistApplicationListResponse {
  ok: boolean;
  items: JournalistApplication[];
  total?: number;
}

export async function listJournalistApplications(params: { status?: 'pending' | 'all' } = { status: 'pending' }) {
  const res = await adminApi.get<JournalistApplicationListResponse>('/admin/community/journalist-applications', {
    params: { status: params.status || 'pending' },
  });
  if (!res.data?.ok) throw new Error('Failed to load journalist applications');
  return res.data;
}

export async function verifyJournalist(reporterId: string) {
  const res = await adminApi.post<{ ok: boolean }>(`/admin/community/journalists/${encodeURIComponent(reporterId)}/verify`);
  if (!res.data?.ok) throw new Error('Failed to verify journalist');
  return res.data;
}

export async function rejectJournalist(reporterId: string) {
  const res = await adminApi.post<{ ok: boolean }>(`/admin/community/journalists/${encodeURIComponent(reporterId)}/reject`);
  if (!res.data?.ok) throw new Error('Failed to reject/downgrade journalist');
  return res.data;
}
