import { useQuery } from '@tanstack/react-query';
import { listReporterContacts, ReporterContactListResponse } from '@/lib/api/reporterDirectory';
import type { AreaType, ReporterBeat, ReporterContact, ReporterStatus } from './reporterDirectory.types';

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

// New reporter directory endpoint hook (admin)
export interface ReporterDirectoryFilters {
  search?: string;
  state?: string;
  district?: string;
  taluka?: string;
  areaType?: AreaType;
  beat?: ReporterBeat;
  status?: ReporterStatus;
  page?: number;
  limit?: number;
}

interface ReporterDirectoryResponse {
  ok: boolean;
  items: ReporterContact[];
  total: number;
  page: number;
  pages: number;
}

export function useReporterDirectory(filters: ReporterDirectoryFilters) {
  return useQuery<ReporterDirectoryResponse, any>({
    queryKey: ['admin', 'reporter-directory', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      (Object.entries(filters) as [string, any][]).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          params.append(k, String(v));
        }
      });

      const res = await fetch(`/api/admin/community/reporter-directory?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        const err: any = new Error('Failed to load reporter directory');
        try {
          const body = JSON.parse(text);
          if (body?.code === 'UNAUTHORIZED' || res.status === 401) {
            err.isUnauthorized = true;
          }
        } catch {}
        throw err;
      }
      return res.json();
    },
    staleTime: 30_000,
  });
}
