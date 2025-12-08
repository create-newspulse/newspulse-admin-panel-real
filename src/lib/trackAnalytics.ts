// 📁 src/lib/trackAnalytics.ts

export const trackAnalytics = async (page: string, articleId?: string) => {
  try {
    await fetch(`${import.meta.env.VITE_API_URL}/analytics/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page, articleId }),
    });
  } catch (error) {
    console.error('❌ Analytics track failed:', error);
  }
};
