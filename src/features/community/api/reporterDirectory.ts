import { useQuery } from '@tanstack/react-query';
import { listReporterContacts, ReporterContactListResponse } from '@/lib/api/reporterDirectory';

export interface UseReporterContactsParams {
  page?: number;
  limit?: number;
  q?: string;
  city?: string;
  state?: string;
  country?: string;
}

export interface ReporterContactsQueryError extends Error {
  status?: number;
  isUnauthorized?: boolean;
}

export function useReporterContactsQuery(params: UseReporterContactsParams = { page: 1, limit: 20 }) {
  return useQuery<ReporterContactListResponse, ReporterContactsQueryError>({
    queryKey: ['reporter-contacts', params],
    queryFn: async () => {
      try {
        return await listReporterContacts(params);
      } catch (err: any) {
        const status = err?.response?.status || err?.status;
        if (status === 401) {
          const e: ReporterContactsQueryError = new Error('unauthorized');
          e.status = 401;
          e.isUnauthorized = true;
          throw e;
        }
        throw err;
      }
    },
    staleTime: 30_000,
  });
}
