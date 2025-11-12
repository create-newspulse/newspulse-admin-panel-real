import axios from 'axios';
import { LanguageIssue } from './languageTool';

const HINDWI_ENDPOINT = process.env.HINDWI_ENDPOINT || '';

// Stub Hindi adapter (returns empty issues if endpoint missing)
export async function checkHindi(text: string): Promise<LanguageIssue[]> {
  if (!text.trim()) return [];
  if (!HINDWI_ENDPOINT) return [];
  try {
    const res = await axios.post(HINDWI_ENDPOINT, { text });
    return (res.data.issues || []).map((i: any) => ({
      offset: i.offset, length: i.length, message: i.message, rule: i.rule || 'hindwi_rule'
    }));
  } catch (e) {
    return [{ offset: 0, length: 0, message: 'Hindi adapter error', rule: 'hindwi_error' }];
  }
}
