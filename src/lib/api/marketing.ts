import { adminApiClient } from '@/lib/adminApiClient';
import { normalizeMarketingData, type MarketingData } from '@/lib/marketing';

export const MARKETING_SUMMARY_ENDPOINT = '/admin/marketing/performance/summary';
export const MARKETING_SAVE_ENDPOINT = '/admin/marketing';

export class MarketingApiError extends Error {
  status?: number;
  code?: string;
  body?: unknown;
  endpoint: string;

  constructor(endpoint: string, error: any) {
    const status = Number(error?.response?.status || 0) || undefined;
    const body = error?.response?.data;
    const code = typeof body?.code === 'string' ? body.code : error?.code;
    const message = typeof body?.message === 'string' && body.message.trim()
      ? body.message
      : error?.message || 'Marketing API request failed';
    super(message);
    this.name = 'MarketingApiError';
    this.status = status;
    this.code = code;
    this.body = body;
    this.endpoint = endpoint;
  }
}

function unwrap<T = any>(raw: any): T {
  if (raw && typeof raw === 'object') {
    if ('workspace' in raw) return (raw as any).workspace as T;
    if ('marketing' in raw) return (raw as any).marketing as T;
    if ('data' in raw) return unwrap<T>((raw as any).data);
    if ('result' in raw) return unwrap<T>((raw as any).result);
  }
  return raw as T;
}

export async function getMarketingWorkspace(): Promise<MarketingData> {
  const endpoint = MARKETING_SUMMARY_ENDPOINT;
  try {
    const res = await adminApiClient.get(endpoint);
    return normalizeMarketingData(unwrap<MarketingData>((res as any)?.data));
  } catch (error) {
    throw new MarketingApiError(endpoint, error);
  }
}

export async function saveMarketingWorkspace(workspace: MarketingData): Promise<MarketingData> {
  const endpoint = MARKETING_SAVE_ENDPOINT;
  try {
    const res = await adminApiClient.put(endpoint, { workspace });
    return normalizeMarketingData(unwrap<MarketingData>((res as any)?.data));
  } catch (error) {
    throw new MarketingApiError(endpoint, error);
  }
}
