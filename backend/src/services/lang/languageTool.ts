import axios from 'axios';

const LT_ENDPOINT = process.env.LT_ENDPOINT || 'https://api.languagetool.org/v2/check';
const LT_API_KEY = process.env.LT_API_KEY || '';

export interface LanguageIssue {
  offset: number;
  length: number;
  message: string;
  rule: string;
  suggestions?: string[];
}

export async function checkEnglish(text: string): Promise<LanguageIssue[]> {
  if (!text.trim()) return [];
  try {
    const params = new URLSearchParams();
    params.append('text', text);
    params.append('language', 'en-US');
    const res = await axios.post(LT_ENDPOINT, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': LT_API_KEY ? `Bearer ${LT_API_KEY}` : undefined }
    });
    const matches = res.data.matches || [];
    return matches.map((m: any) => ({
      offset: m.offset,
      length: m.length,
      message: m.message,
      rule: m.rule?.id || 'unknown',
      suggestions: m.replacements?.slice(0,3).map((r: any)=> r.value) || []
    }));
  } catch (err) {
    return [{ offset: 0, length: 0, message: 'LanguageTool error', rule: 'lt_error' }];
  }
}
