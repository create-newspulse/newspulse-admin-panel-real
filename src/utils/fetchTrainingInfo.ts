// src/utils/fetchTrainingInfo.ts
import axios from 'axios';

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
    const res = await axios.get(`${import.meta.env.VITE_API_URL}/system/ai-training-info`);

    const data = res?.data?.data;

    if (!res.data?.success || !data || !data.lastTrained) {
      console.warn('⚠️ AI training info missing or incomplete:', res.data);
      throw new Error('AI training info missing required fields.');
    }

    return data;
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('❌ Error loading AI training info:', error);
    throw new Error('❌ Failed to load AI training info.');
  }
};
