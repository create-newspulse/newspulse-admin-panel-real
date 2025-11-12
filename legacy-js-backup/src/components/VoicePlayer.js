import { jsx as _jsx } from "react/jsx-runtime";
import { useState } from 'react'; // if used
const VoicePlayer = ({ text, language }) => {
    const [speaking, setSpeaking] = useState(false);
    const handlePlay = () => {
        const utterance = new SpeechSynthesisUtterance(text);
        // ≡ƒîÉ Language-specific voice selection
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
        // ≡ƒæ⌐ Preferred female voice
        const voices = window.speechSynthesis.getVoices();
        const femaleVoice = voices.find((v) => v.lang.startsWith(utterance.lang) &&
            (v.name.toLowerCase().includes('female') ||
                v.name.toLowerCase().includes('woman') ||
                v.name.toLowerCase().includes('kajal') || // Gujarati sample
                v.name.toLowerCase().includes('neural')));
        if (femaleVoice)
            utterance.voice = femaleVoice;
        utterance.onstart = () => setSpeaking(true);
        utterance.onend = () => setSpeaking(false);
        speechSynthesis.speak(utterance);
    };
    return (_jsx("button", { onClick: handlePlay, className: `px-3 py-1 text-sm rounded bg-pink-600 text-white hover:bg-pink-700 transition ${speaking ? 'opacity-60' : ''}`, disabled: speaking, children: speaking ? '≡ƒöè Playing...' : 'Γû╢∩╕Å Listen' }));
};
export default VoicePlayer;
