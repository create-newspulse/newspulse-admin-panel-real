// 📁 src/lib/voicePlayer.ts
const voiceMap: Record<string, string> = {
  English: 'en-IN',
  Hindi: 'hi-IN',
  Gujarati: 'gu-IN',
};

export function speak(text: string, languageOverride?: string) {
  if (!window.speechSynthesis) {
    console.warn('❌ Speech Synthesis not supported in this browser.');
    return;
  }

  const langKey = languageOverride || localStorage.getItem('preferredLanguage') || 'English';
  const langCode = voiceMap[langKey] || 'en-IN';

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = langCode;
  speechSynthesis.speak(utterance);
}
