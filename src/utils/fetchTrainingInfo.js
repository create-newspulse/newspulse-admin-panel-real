// src/utils/fetchTrainingInfo.ts
import apiClient from '@lib/api';
export const fetchTrainingInfo = async () => {
    try {
        const res = await apiClient.get('/system/ai-training-info');
        const json = res.data;
        const data = json?.data;
        if (!json?.success || !data || !data.lastTrained) {
            console.warn('⚠️ AI training info missing or incomplete:', json);
            throw new Error('AI training info missing required fields.');
        }
        return data;
    }
    catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        console.error('❌ Error loading AI training info:', error);
        throw new Error('❌ Failed to load AI training info.');
    }
};
