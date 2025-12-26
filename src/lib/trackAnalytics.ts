// 📁 src/lib/trackAnalytics.ts

import { adminFetch } from '@/lib/http/adminFetch';

export const trackAnalytics = async (page: string, articleId?: string) => {
  try {
    await adminFetch('/analytics/track', {
      method: 'POST',
      json: { page, articleId },
    });
  } catch (error) {
    console.error('❌ Analytics track failed:', error);
  }
};
