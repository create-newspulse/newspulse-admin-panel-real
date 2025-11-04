// 📁 src/utils/pushUtils.ts
export const sendPushAlert = async (message, category = 'general') => {
    try {
        const apiUrl = import.meta.env.VITE_API_URL;
        if (!apiUrl) {
            throw new Error('VITE_API_URL is not defined in environment variables.');
        }
        const res = await fetch(`${apiUrl}/push-alerts/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, category }),
        });
        if (!res.ok) {
            console.error('❌ Push alert failed with status:', res.status);
            return null;
        }
        return await res.json();
    }
    catch (err) {
        console.error('❌ Failed to send push alert:', err);
        return null;
    }
};
