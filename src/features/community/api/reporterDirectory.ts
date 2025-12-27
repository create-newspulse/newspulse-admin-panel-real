import { useQuery } from '@tanstack/react-query';
import { listReporterContacts, ReporterContactListResponse } from '@/lib/api/reporterDirectory';
import api from '@/lib/api.js';
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
      const params: Record<string, string> = {};
      (Object.entries(filters) as [string, any][]).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') params[k] = String(v);
      });

      try {
        const res = await api.get('/api/admin/community/reporter-directory', { params });
        return res.data;
      } catch (err: any) {
        const status = err?.response?.status;
        const body = err?.response?.data;
        const e: any = new Error('Failed to load reporter directory');
        if (status === 401 || body?.code === 'UNAUTHORIZED') e.isUnauthorized = true;
        throw e;
      }
    },
    staleTime: 30_000,
  });
}
