import adminApi from '@/api/adminApi';

export interface ReporterContact {
  id: string;
  reporterKey?: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  // Admin-only private notes (never exposed publicly). Nullable if not set.
  notes?: string | null;
  totalStories: number;
  pendingStories: number;
  approvedStories: number;
  lastStoryAt: string; // ISO date
}

export interface ReporterContactListResponse {
  ok: boolean;
  items: ReporterContact[];
  total: number;
}

export async function listReporterContacts(params?: {
  q?: string;
  city?: string;
  state?: string;
  country?: string;
  page?: number;
  limit?: number;
  sortBy?: 'lastStoryAt' | 'totalStories';
  sortDir?: 'asc' | 'desc';
}) {
  const res = await adminApi.get<ReporterContactListResponse>('/admin/community/reporter-contacts', { params });

  if (!res.data?.ok) {
    throw new Error('Failed to load reporter contacts');
  }

  return res.data;
}

// Update private admin-only reporter notes. Backend should secure this route.
export async function updateReporterContactNotes(reporterKey: string, notes: string) {
  try {
    const res = await adminApi.post<{ ok: boolean; notes?: string }>(
      '/admin/community/reporter-contact-notes',
      { reporterKey, notes }
    );
    if (!res.data?.ok) throw new Error('Failed to save reporter notes');
    return res.data;
  } catch (err: any) {
    const status = err?.response?.status;
    if (status === 401) {
      const e = new Error('Admin session expired. Please log in again.') as any;
      e.isUnauthorized = true;
      throw e;
    }
    if (status === 404) {
      const e = new Error('Notes endpoint not available in this environment.') as any;
      e.isNotImplemented = true;
      throw e;
    }
    throw err;
  }
}
