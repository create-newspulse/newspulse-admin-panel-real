import React, { useEffect, useState } from "react";
import Slider from "react-slick";
import axios from "axios";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import { speak } from "../lib/voicePlayer";

interface Wonder {
  quote: string;
  videoEmbedUrl: string;
  source: string;
  creator: string;
  category: string;
  language?: string;
  musicUrl?: string;
  date?: string;
}

const DailyWonderSlider: React.FC = () => {
  const [wonders, setWonders] = useState<Wonder[]>([]);
  const [selectedLang, setSelectedLang] = useState<"en" | "hi" | "gu">("en");
  const [bgAudio, setBgAudio] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    axios
      .get(`${import.meta.env.VITE_API_URL}/daily-wonder`)
      .then((res) => {
        const fetched = res.data.data;
        if (res.data.success) {
          setWonders(Array.isArray(fetched) ? fetched : [fetched]);
        } else {
          console.warn("⚠️ API responded without success flag.");
        }
      })
      .catch((err) => console.error("❌ Failed to load wonders:", err));
  }, []);

  const playNarration = (text: string, lang: "en" | "hi" | "gu") => {
    speak(text, lang);
  };

  const handleMusicPlay = (url?: string) => {
    if (!url) return;
    if (bgAudio) bgAudio.pause();
    const audio = new Audio(url);
    audio.loop = true;
    audio.play().catch(console.error);
    setBgAudio(audio);
  };

  const settings = {
    dots: true,
    infinite: true,
    speed: 700,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 20000,
    adaptiveHeight: true,
  };

  return (
    <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-xl shadow-xl mb-10 transition-all duration-300">
      <div className="p-6">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-3">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
            🌄 Daily Wonders
          </h2>
          <select
            className="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-sm rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-300"
            value={selectedLang}
            onChange={(e) =>
              setSelectedLang(e.target.value as "en" | "hi" | "gu")
            }
          >
            <option value="en">🌐 English</option>
            <option value="hi">🇮🇳 Hindi</option>
            <option value="gu">🇮🇳 Gujarati</option>
          </select>
        </div>

        {wonders.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-10">
            No wonders available right now.
          </div>
        ) : (
          <Slider {...settings}>
            {wonders.map((item, index) => (
              <div key={index} className="px-2 sm:px-4">
                <p className="italic text-lg text-blue-700 dark:text-blue-300 mb-4 leading-relaxed">
                  “{item.quote}”
                </p>

                <div className="flex flex-wrap gap-3 mb-4">
                  <button
                    onClick={() => playNarration(item.quote, selectedLang)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-sm transition"
                  >
                    🔈 Narrate
                  </button>
                  {item.musicUrl && (
                    <button
                      onClick={() => handleMusicPlay(item.musicUrl)}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-md text-sm transition"
                    >
                      🎵 Play Music
                    </button>
                  )}
                </div>

                <div className="aspect-video rounded-lg overflow-hidden shadow-md border border-gray-200 dark:border-gray-700 mb-3">
                  <iframe
                    src={item.videoEmbedUrl}
                    title={`Wonder ${index}`}
                    className="w-full h-full"
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                    loading="lazy"
                  ></iframe>
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-400">
                  📚 <strong>{item.category}</strong> • By{" "}
                  <a
                    href={item.source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-blue-600 dark:hover:text-blue-300"
                  >
                    {item.creator}
                  </a>
                </p>
              </div>
            ))}
          </Slider>
        )}
      </div>
    </div>
  );
};

export default DailyWonderSlider;
