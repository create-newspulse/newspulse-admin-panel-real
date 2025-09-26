import { useState } from 'react';

const demoArticles = [
  { id: '001', title: 'Breaking News: AI transforms journalism', lang: 'en' },
  { id: '002', title: 'હવે ગુજરાતી સમાચાર પણ વાંચશે', lang: 'gu' },
  { id: '003', title: 'अब हिंदी में भी एआई से समाचार पढ़िए', lang: 'hi' },
];

export default function ManageNews() {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [voiceGender, setVoiceGender] = useState<'female' | 'male'>('female');
  const [speed, setSpeed] = useState<'normal' | 'slow' | 'fast'>('normal');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const playVoice = (text: string, id: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-IN';
    utterance.rate = speed === 'fast' ? 1.5 : speed === 'slow' ? 0.75 : 1;
    utterance.voice =
      speechSynthesis.getVoices().find((v) =>
        voiceGender === 'male' ? v.name.toLowerCase().includes('male') : v.name.toLowerCase().includes('female')
      ) || null;

    utterance.onend = () => setPlayingId(null);
    setPlayingId(id);
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  };

  const saveMP3 = (text: string, id: string) => {
    alert(`💾 Simulated save: "${id}.mp3" generated from article voice.`);
  };

  const stopVoice = () => {
    speechSynthesis.cancel();
    setPlayingId(null);
  };

  const handleCheckbox = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const playSelected = () => {
    const texts = demoArticles
      .filter((a) => selectedIds.includes(a.id))
      .map((a) => a.title)
      .join('. ');
    playVoice(texts, 'batch');
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">📁 Manage News Articles</h1>

      {demoArticles.map((article) => (
        <div key={article.id} className="bg-white rounded shadow p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              checked={selectedIds.includes(article.id)}
              onChange={() => handleCheckbox(article.id)}
            />
            <p className="font-semibold text-lg">{article.title}</p>
          </div>
          <div className="flex gap-2 flex-wrap mt-2">
            <button className="bg-green-600 text-white px-3 py-1 rounded">✏️ Edit</button>
            <button className="bg-red-600 text-white px-3 py-1 rounded">🗑 Delete</button>
            <button
              onClick={() => playVoice(article.title, article.id)}
              className="bg-purple-600 text-white px-3 py-1 rounded"
            >
              🔊 {playingId === article.id ? 'Playing...' : 'Test Voice'}
            </button>
            <button
              onClick={() => playVoice(article.title, article.id)}
              className="bg-gray-700 text-white px-3 py-1 rounded"
            >
              🔁 Replay
            </button>
            <button
              onClick={stopVoice}
              className="bg-black text-white px-3 py-1 rounded"
            >
              ⏹ Stop
            </button>
            <button
              onClick={() =>
                setVoiceGender(voiceGender === 'female' ? 'male' : 'female')
              }
              className="bg-blue-500 text-white px-3 py-1 rounded"
            >
              🎙 Switch to {voiceGender === 'female' ? 'Male' : 'Female'}
            </button>
            <button
              onClick={() => saveMP3(article.title, article.id)}
              className="bg-yellow-500 text-white px-3 py-1 rounded"
            >
              💾 Save MP3
            </button>
            <select
              value={speed}
              onChange={(e) => setSpeed(e.target.value as 'normal' | 'fast' | 'slow')}
              className="border px-2 py-1 rounded text-sm"
            >
              <option value="normal">🌐 Normal</option>
              <option value="slow">🐢 Slow</option>
              <option value="fast">⚡ Fast</option>
            </select>
          </div>
        </div>
      ))}

      {selectedIds.length > 0 && (
        <div className="mt-6 p-4 bg-slate-100 rounded shadow border">
          <h3 className="font-semibold mb-2">🎧 Playlist Actions</h3>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={playSelected}
              className="bg-purple-700 text-white px-4 py-1 rounded"
            >
              ▶️ Play All ({selectedIds.length})
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="bg-red-500 text-white px-4 py-1 rounded"
            >
              ❌ Clear Playlist
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
