// 📁 src/utils/analytics.ts
import axios from 'axios';

export const logVisit = async (page: string, articleId?: string) => {
  try {
    await axios.post('/api/analytics/log', {
      page,
      articleId: articleId || null,
      userAgent: navigator.userAgent,
      referrer: document.referrer,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('📉 Analytics log failed:', message);
  }
};
