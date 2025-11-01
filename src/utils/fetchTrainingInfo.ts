// src/utils/fetchTrainingInfo.ts
import apiClient from '@lib/api';

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
    const res = await apiClient.get('/system/ai-training-info');
    const json = res.data as any;
    const data = json?.data;
    if (!json?.success || !data || !data.lastTrained) {
      console.warn('⚠️ AI training info missing or incomplete:', json);
      throw new Error('AI training info missing required fields.');
    }
    return data as TrainingInfo;
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('❌ Error loading AI training info:', error);
    throw new Error('❌ Failed to load AI training info.');
  }
};
