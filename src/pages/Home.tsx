import { useEffect } from 'react';
import { useTranslate } from '../hooks/useTranslate';
import { speak } from '../lib/voicePlayer';
import { trackAnalytics } from '../lib/trackAnalytics';

// 🔹 Components
import WeatherStrip from '../components/WeatherStrip';
import DailyWonderSlider from '../components/DailyWonderSlider';
import DailyQuoteBlock from '../components/DailyQuoteBlock';
import LiveTvSection from '../components/LiveTvSection';
import TodayInHistoryBlock from '../components/TodayInHistoryBlock';
import PollCard from '../components/PollCard';

export default function Home() {
  const t = useTranslate();

  // ✅ Track homepage visit
  useEffect(() => {
    trackAnalytics('/');
  }, []);

  // 🔊 Speak welcome message
  const handleSpeak = () => {
    speak(t('welcome'));
  };

  return (
    <div className="p-6">
      {/* 🌤️ Weather Info Bar */}
      <div className="mb-6">
        <WeatherStrip />
      </div>

      {/* 🧠 Welcome Section */}
      <h1 className="text-3xl font-bold mb-4">{t('welcome')}</h1>

      <button
        onClick={handleSpeak}
        className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded mt-2"
      >
        🔊 {t('playWelcome')}
      </button>

      <div className="mt-8">
        <LiveTvSection />
      </div>

      {/* 📊 Poll of the Day */}
      <div className="mt-8">
        <PollCard />
      </div>

      {/* ✨ Daily Quote Block */}
      <div className="mt-8">
        <DailyQuoteBlock />
      </div>

      {/* 📜 Today in History */}
      <div className="mt-8">
        <TodayInHistoryBlock />
      </div>

      {/* 🌄 Daily Wonder Slider */}
      <div className="mt-10">
        <DailyWonderSlider />
      </div>
    </div>
  );
}
