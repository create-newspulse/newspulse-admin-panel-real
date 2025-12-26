// 📁 src/lib/trackAnalytics.ts
import { adminFetch } from './http/adminFetch';

export const trackAnalytics = async (page, articleId) => {
    try {
        await adminFetch('/analytics/track', {
            method: 'POST',
            json: { page, articleId },
        });
    }
    catch (error) {
        console.error('❌ Analytics track failed:', error);
    }
};
