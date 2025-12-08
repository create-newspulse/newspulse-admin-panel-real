import React from 'react';
import { useLanguage } from '../context/LanguageContext';

interface WeatherData {
  icon: string;
  temp: number;
  descriptions: {
    English: string;
    Hindi: string;
    Gujarati: string;
  };
}

const WeatherStrip: React.FC = () => {
  const { selectedLanguage } = useLanguage();

  // Dummy data (replace with live API response in future)
  const weather: WeatherData = {
    icon: '01d', // Clear Sky (OpenWeather icon code)
    temp: 34, // Temperature in Celsius
    descriptions: {
      English: 'Clear Sky',
      Hindi: 'स्वच्छ आकाश',
      Gujarati: 'ચોખ્ખું આકાશ',
    },
  };

  const iconUrl = `https://openweathermap.org/img/wn/${weather.icon}.png`;

  return (
    <div className="bg-blue-100 text-blue-900 dark:bg-gray-800 dark:text-white text-sm py-2 px-4 flex justify-between items-center">
      <div className="flex items-center gap-2">
        <img src={iconUrl} alt="Weather Icon" className="w-6 h-6" />
        <span className="font-medium">
          {weather.temp}°C – {weather.descriptions[selectedLanguage as keyof typeof weather.descriptions]}
        </span>
      </div>
      <span className="text-xs">📍 Ahmedabad</span>
    </div>
  );
};

export default WeatherStrip;
