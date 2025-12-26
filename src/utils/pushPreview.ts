// 📁 src/utils/pushPreview.ts

import { adminJson } from '@/lib/http/adminFetch';

/**
 * Fetches a formatted push preview for a headline and category.
 * @param headline - The news headline text.
 * @param category - The news category.
 * @returns A string representing the push preview.
 */
export const getPushPreview = async (
  headline: string,
  category: string
): Promise<string> => {
  try {
    const data = await adminJson<any>('/alerts/preview', {
      method: 'POST',
      json: { headline, category },
    });
    return data?.preview || '';
  } catch (error) {
    console.error('❌ Failed to fetch push preview:', error);
    return '⚠️ Preview unavailable';
  }
};
