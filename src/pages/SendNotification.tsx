// 📁 src/pages/SendNotification.tsx

import { useState } from 'react';
import { adminJson } from '@/lib/http/adminFetch';

export default function SendNotification() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [status, setStatus] = useState('');

  const handleSend = async () => {
    if (!title || !body) {
      setStatus('⚠️ Title and body required');
      return;
    }

    try {
      const data = await adminJson<any>('/notifications/send', {
        method: 'POST',
        json: { title, body },
      });
      setStatus(data?.message);
    } catch (err) {
      console.error(err);
      setStatus('❌ Failed to send notification');
    }
  };

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">🔔 Send Push Notification</h1>

      <input
        type="text"
        placeholder="Notification Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full mb-3 border p-2 rounded"
      />

      <textarea
        placeholder="Notification Message"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        className="w-full mb-3 border p-2 rounded"
      />

      <button
        onClick={handleSend}
        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded"
      >
        🚀 Send Notification
      </button>

      {status && <p className="mt-4 text-sm text-green-600">{status}</p>}
    </div>
  );
}
