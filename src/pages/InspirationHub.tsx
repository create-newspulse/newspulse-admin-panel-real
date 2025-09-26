import React, { useEffect, useState } from 'react';
import axios from 'axios';

const InspirationHub: React.FC = () => {
  const [embedUrl, setEmbedUrl] = useState('');
  const [creator, setCreator] = useState<{ name: string; country: string; featured: string[] } | null>(null);
  const [quiz, setQuiz] = useState('');
  const [filter, setFilter] = useState('all');

  const fetchDroneVideo = async () => {
    try {
      const res = await axios.get('/api/drone-feed'); // 🔁 Replace with your backend route
      setEmbedUrl(res.data?.embedUrl || '');
    } catch (err) {
      console.error('❌ Drone video fetch failed', err);
    }
  };

  const fetchCreatorSpotlight = async () => {
    try {
      const res = await axios.get('/api/creator-spotlight');
      setCreator(res.data);
    } catch (err) {
      console.warn('⚠️ Creator spotlight fetch failed');
    }
  };

  const fetchQuiz = async () => {
    try {
      const res = await axios.get('/api/daily-quiz');
      setQuiz(res.data?.question || '');
    } catch (err) {
      console.warn('⚠️ Quiz fetch failed');
    }
  };

  useEffect(() => {
    fetchDroneVideo();
    fetchCreatorSpotlight();
    fetchQuiz();
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-8">🌄 Inspiration Hub</h1>

      {/* 🎥 DroneTV Embed */}
      <div className="rounded-xl overflow-hidden shadow border mb-6">
        {embedUrl ? (
          <iframe
            src={embedUrl}
            title="DroneTV"
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full aspect-video"
          />
        ) : (
          <p className="text-center text-gray-400 p-4">⏳ Loading drone video...</p>
        )}
        <p className="text-xs text-gray-500 italic text-center mt-2">
          🎥 Embedded from AirVūz.com. No content stored or modified. Rights belong to original creators.
        </p>
      </div>

      {/* 🎙️ Voice Narration */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow mb-6 border">
        <h2 className="text-lg font-semibold mb-2">🎙️ Voiceover Narration</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">Today’s story narrated over the visuals — auto-generated silently using secure tech.</p>
        <audio controls className="mt-2 w-full">
          <source src="/api/voice-narration" type="audio/mpeg" />
          Your browser does not support the audio element.
        </audio>
      </div>

      {/* 👤 Creator Spotlight */}
      {creator && (
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow mb-6 border">
          <h2 className="text-lg font-semibold mb-2">👤 Creator Spotlight</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {creator.name} ({creator.country}) — Featured work:
          </p>
          <ul className="list-disc list-inside mt-2 text-sm text-blue-600">
            {creator.featured.map((title, idx) => (
              <li key={idx}>{title}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 🧠 Daily Drone Quiz */}
      {quiz && (
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow mb-6 border">
          <h2 className="text-lg font-semibold mb-2">🧠 Daily Drone Quiz</h2>
          <p className="text-slate-700 dark:text-slate-200 text-sm">{quiz}</p>
        </div>
      )}

      {/* 🌍 Location Filter */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow border">
        <h2 className="text-lg font-semibold mb-2">🌍 Filter by Location</h2>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="mt-2 px-3 py-2 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white w-full"
        >
          <option value="all">All Locations</option>
          <option value="india">India Only</option>
          <option value="waterfalls">Waterfalls</option>
          <option value="sunsets">Sunsets</option>
          <option value="beaches">Beach Views</option>
        </select>
      </div>
    </div>
  );
};

export default InspirationHub;
