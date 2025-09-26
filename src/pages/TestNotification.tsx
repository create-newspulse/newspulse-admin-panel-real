import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';

const TestNotification = () => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);

  const isFormValid = title.trim() && body.trim();

  const sendNotification = useCallback(async () => {
    if (!isFormValid) {
      toast.error('⚠️ Please fill in both title and body.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success('✅ Notification sent successfully!');
        setTitle('');
        setBody('');
      } else {
        toast.error(data.message || '❌ Failed to send notification.');
      }
    } catch (err: any) {
      toast.error('❌ Error sending notification');
    } finally {
      setLoading(false);
    }
  }, [title, body]);

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6 bg-white dark:bg-slate-800 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
        🔔 Test Push Notification
      </h2>

      <div className="space-y-4">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Notification Title"
          className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded bg-gray-50 dark:bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Notification Title"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Notification Body"
          rows={4}
          className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded bg-gray-50 dark:bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Notification Body"
        />

        <button
          onClick={sendNotification}
          disabled={loading}
          className={`w-full py-2 px-4 rounded text-white font-semibold transition 
            ${loading ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {loading ? 'Sending...' : '🚀 Send Notification'}
        </button>
      </div>
    </div>
  );
};

export default TestNotification;
