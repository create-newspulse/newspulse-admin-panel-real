// 📁 src/utils/pushPreview.ts

import axios from 'axios';

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
    const response = await axios.post(`${import.meta.env.VITE_API_URL}/alerts/preview`, {
      headline,
      category,
    });

    return response.data.preview || '';
  } catch (error) {
    console.error('❌ Failed to fetch push preview:', error);
    return '⚠️ Preview unavailable';
  }
};
