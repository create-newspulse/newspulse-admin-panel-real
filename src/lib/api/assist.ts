import apiClient from '@/lib/api';

export interface AssistSuggestResponse {
  title: string;
  slug: string;
  summary: string;
  tips?: string[];
  language?: string;
}

/**
 * Call backend editorial assist. Returns refined title, slug, summary, tips.
 * Throws on network errors so caller can decide fallback.
 */
export async function assistSuggest(payload: { title?: string; content?: string; language?: string }): Promise<AssistSuggestResponse> {
  const res = await apiClient.post<AssistSuggestResponse>('/assist/suggest', payload);
  return res.data;
}

export interface AssistSuggestV2Response {
  title: { standard: string };
  slug: { latin: string; native: string };
  summary: { neutral: string; impact: string; analytical: string };
  seo: { keywords: string[]; hashtags: string[]; titleHookScore: number; summaryLen: number; notes: string[] };
  compliance: { ptiFlags: string[]; riskWords: string[]; advice: string };
  duplicate: { score: number; closestId: string | null };
  language: string;
}

export async function assistSuggestV2(payload: { title?: string; content?: string; language?: string }) : Promise<AssistSuggestV2Response> {
  const res = await apiClient.post<AssistSuggestV2Response>('/assist/suggest/v2', payload);
  return res.data;
}
