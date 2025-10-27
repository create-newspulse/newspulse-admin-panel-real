// src/utils/fetchTrainingInfo.ts
import { API_BASE_PATH } from '@lib/api';

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
  const res = await fetch(`${API_BASE_PATH}/system/ai-training-info`, { credentials: 'include' });
    const ct = res.headers.get('content-type') || '';
    if (!res.ok || !ct.includes('application/json')) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Bad response: ${res.status}. Body: ${txt.slice(0, 200)}`);
    }
    const json = await res.json();
    const data = json?.data;
    if (!json?.success || !data || !data.lastTrained) {
      console.warn('⚠️ AI training info missing or incomplete:', json);
      throw new Error('AI training info missing required fields.');
    }
    return data;
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('❌ Error loading AI training info:', error);
    throw new Error('❌ Failed to load AI training info.');
  }
};
