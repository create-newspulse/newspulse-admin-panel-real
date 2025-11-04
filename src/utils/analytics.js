// 📁 src/utils/analytics.ts
import apiClient from '@lib/api';
export const logVisit = async (page, articleId) => {
    try {
        await apiClient.post('/analytics/log', {
            page,
            articleId: articleId || null,
            userAgent: navigator.userAgent,
            referrer: document.referrer,
        });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn('📉 Analytics log failed:', message);
    }
};
