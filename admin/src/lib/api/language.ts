import { api } from './client';

export async function verifyLanguage(text: string, language: 'en'|'hi'|'gu') {
  const { data } = await api.post('/api/language/verify', { text, language });
  return data as { ok: boolean; issues: Array<{offset:number; length:number; message:string; rule:string}> };
}

export async function translate(text: string, from: 'en'|'hi'|'gu', to: 'en'|'hi'|'gu') {
  const { data } = await api.post('/api/language/translate', { text, from, to });
  return data as { translated: string };
}

export async function readability(text: string, language: 'en'|'hi'|'gu') {
  const { data } = await api.post('/api/language/readability', { text, language });
  return data as { grade:number; readingTimeSec:number };
}
