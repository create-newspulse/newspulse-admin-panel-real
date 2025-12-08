import apiClient from '@/lib/api';

export async function verifyLanguage(text: string, language: 'en'|'hi'|'gu') {
  const { data } = await apiClient.post('/language/verify', { text, language });
  return data as { ok: boolean; issues: Array<{offset:number; length:number; message:string; rule:string}> };
}

export async function translate(text: string, from: 'en'|'hi'|'gu', to: 'en'|'hi'|'gu') {
  const { data } = await apiClient.post('/language/translate', { text, from, to });
  return data as { translated: string };
}

export async function readability(text: string, language: 'en'|'hi'|'gu') {
  const { data } = await apiClient.post('/language/readability', { text, language });
  return data as { grade:number; readingTimeSec:number };
}
