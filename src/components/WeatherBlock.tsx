import { useEffect } from 'react';
import { useTranslate } from '../hooks/useTranslate';
import { speak } from '../lib/voicePlayer';
import { trackAnalytics } from '../lib/trackAnalytics';

import DailyWonderSlider from '../components/DailyWonderSlider';
import WeatherBlock from '../components/WeatherBlock';

export default function Home() {
  const t = useTranslate();

  useEffect(() => {
    trackAnalytics('/');
  }, []);

  const handleSpeak = () => {
    speak(t('welcome'));
  };

  return (
    <div className="p-6">
      {/* 🧠 Welcome Header */}
      <h1 className="text-3xl font-bold mb-4">{t('welcome')}</h1>

      {/* 🔊 Speak Button */}
      <button
        onClick={handleSpeak}
        className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded mt-2"
      >
        🔊 {t('welcome')} {/* ✅ Changed from t('playWelcome') to t('welcome') */}
      </button>

      {/* 🌤️ Weather Info */}
      <div className="mt-8">
        <WeatherBlock />
      </div>

      {/* 🌄 Daily Wonder Slider */}
      <div className="mt-10">
        <DailyWonderSlider />
      </div>
    </div>
  );
}
