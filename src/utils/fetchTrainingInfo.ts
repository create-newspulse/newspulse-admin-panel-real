// src/utils/fetchTrainingInfo.ts
import { apiUrl } from '@lib/apiBase';

interface TrainingInfo {
  lastTrained: string;
  nextTraining?: string;
  trainer?: string;
  modelVersion?: string;
  statusNote?: string;
  updatedBy?: string;
  articlesAnalyzed?: number;
  patternFocus?: string;
  modulesTrained?: string[];
  keywords?: number;
  lockedByFounder?: boolean;
}

export const fetchTrainingInfo = async (): Promise<TrainingInfo> => {
  try {
    const url = apiUrl('/admin/system/ai-training-info');
    if (import.meta.env.DEV) console.log('ADMIN API:', url);
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const json = await res.json();
    const data = json?.data;
    if (!json?.success || !data || !data.lastTrained) {
      console.warn('⚠️ AI training info missing or incomplete:', json);
      throw new Error('AI training info missing required fields.');
    }
    return data as TrainingInfo;
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('❌ Error loading AI training info:', error);
    throw new Error(/HTTP\s+(\d+)/.test(error) ? `Failed: ${error}` : '❌ Failed to load AI training info.');
  }
};
