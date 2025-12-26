// 📁 src/utils/pushUtils.ts

import { adminJson } from '@/lib/http/adminFetch';

export const sendPushAlert = async (message: string, category: string = 'general') => {
  try {
    return await adminJson('/push-alerts/send', {
      method: 'POST',
      json: { message, category },
    });
  } catch (err) {
    console.error('❌ Failed to send push alert:', err);
    return null;
  }
};
