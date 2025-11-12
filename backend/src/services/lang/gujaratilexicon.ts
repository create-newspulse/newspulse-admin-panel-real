import axios from 'axios';
import { LanguageIssue } from './languageTool';

const GL_ENDPOINT = process.env.GL_ENDPOINT || '';
const GL_API_KEY = process.env.GL_API_KEY || '';

export async function checkGujarati(text: string): Promise<LanguageIssue[]> {
  if (!text.trim()) return [];
  if (!GL_ENDPOINT) return [];
  try {
    const res = await axios.post(GL_ENDPOINT, { text }, { headers: { 'X-API-Key': GL_API_KEY } });
    return (res.data.issues || []).map((i: any) => ({
      offset: i.offset, length: i.length, message: i.message, rule: i.rule || 'gujaratilexicon_rule'
    }));
  } catch (e) {
    return [{ offset: 0, length: 0, message: 'Gujarati adapter error', rule: 'gl_error' }];
  }
}
