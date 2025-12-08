import { useState } from 'react'; // if used

interface VoicePlayerProps {
  text: string;
  language: 'en' | 'hi' | 'gu';
}

const VoicePlayer: React.FC<VoicePlayerProps> = ({ text, language }) => {
  const [speaking, setSpeaking] = useState(false);

  const handlePlay = () => {
    const utterance = new SpeechSynthesisUtterance(text);

    // 🌐 Language-specific voice selection
    switch (language) {
      case 'hi':
        utterance.lang = 'hi-IN';
        break;
      case 'gu':
        utterance.lang = 'gu-IN';
        break;
      default:
        utterance.lang = 'en-US';
    }

    // 👩 Preferred female voice
    const voices = window.speechSynthesis.getVoices();
    const femaleVoice = voices.find(
      (v) =>
        v.lang.startsWith(utterance.lang) &&
        (v.name.toLowerCase().includes('female') ||
         v.name.toLowerCase().includes('woman') ||
         v.name.toLowerCase().includes('kajal') || // Gujarati sample
         v.name.toLowerCase().includes('neural'))
    );

    if (femaleVoice) utterance.voice = femaleVoice;

    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);

    speechSynthesis.speak(utterance);
  };

  return (
    <button
      onClick={handlePlay}
      className={`px-3 py-1 text-sm rounded bg-pink-600 text-white hover:bg-pink-700 transition ${
        speaking ? 'opacity-60' : ''
      }`}
      disabled={speaking}
    >
      {speaking ? '🔊 Playing...' : '▶️ Listen'}
    </button>
  );
};

export default VoicePlayer;
