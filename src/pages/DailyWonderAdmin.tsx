import { useState } from 'react';
import api from '@/lib/api.js';

const DailyWonderAdmin = () => {
  const [quote, setQuote] = useState('');
  const [videoEmbedUrl, setVideoEmbedUrl] = useState('');
  const [source, setSource] = useState('');
  const [creator, setCreator] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async () => {
    try {
      await api.post('/api/daily-wonder', {
        quote,
        videoEmbedUrl,
        source,
        creator,
      });
      setMessage('✅ Daily Wonder saved!');
    } catch (err: any) {
      setMessage('❌ Failed to save' + (err?.response?.data?.message ? ': ' + err.response.data.message : ''));
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6 bg-white rounded shadow">
      <h2 className="text-2xl font-bold mb-4">📤 Upload Daily Wonder</h2>

      <input
        placeholder="Enter wonder quote"
        className="w-full mb-3 p-2 border rounded"
        value={quote}
        onChange={(e) => setQuote(e.target.value)}
      />
      <input
        placeholder="Embed video URL (YouTube)"
        className="w-full mb-3 p-2 border rounded"
        value={videoEmbedUrl}
        onChange={(e) => setVideoEmbedUrl(e.target.value)}
      />
      <input
        placeholder="Source link (AirVuz, YouTube etc.)"
        className="w-full mb-3 p-2 border rounded"
        value={source}
        onChange={(e) => setSource(e.target.value)}
      />
      <input
        placeholder="Creator name"
        className="w-full mb-4 p-2 border rounded"
        value={creator}
        onChange={(e) => setCreator(e.target.value)}
      />

      <button onClick={handleSubmit} className="bg-blue-600 text-white px-4 py-2 rounded">
        Save Wonder
      </button>

      {message && <p className="mt-4 text-sm">{message}</p>}
    </div>
  );
};

export default DailyWonderAdmin;
