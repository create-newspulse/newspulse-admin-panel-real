import { useState } from 'react';
import { toast } from 'react-hot-toast';

interface VoiceProps {
  text: string;
}

const VoiceAndExplainer: React.FC<VoiceProps> = ({ text }) => {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  const playVoice = () => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-IN';
    speechSynthesis.speak(utterance);
  };

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/ai/explain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      });
      const data = await res.json();
      setSummary(data.summary || 'No summary returned.');
    } catch (err) {
      toast.error('Failed to fetch explanation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 mt-4">
      <button
        onClick={playVoice}
        className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-500 transition"
      >
        🎧 Play Voice
      </button>
      <button
        onClick={fetchSummary}
        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-500 transition"
      >
        🧠 Explain This
      </button>
      {loading && <p className="text-sm text-gray-400">Generating explanation...</p>}
      {summary && <p className="text-sm mt-2 bg-gray-100 dark:bg-gray-800 p-2 rounded">{summary}</p>}
    </div>
  );
};

export default VoiceAndExplainer;
