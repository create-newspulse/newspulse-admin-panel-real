import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
    return (_jsxs("div", { className: "p-6", children: [_jsx("h1", { className: "text-3xl font-bold mb-4", children: t('welcome') }), _jsxs("button", { onClick: handleSpeak, className: "bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded mt-2", children: ["\uD83D\uDD0A ", t('welcome'), " "] }), _jsx("div", { className: "mt-8", children: _jsx(WeatherBlock, {}) }), _jsx("div", { className: "mt-10", children: _jsx(DailyWonderSlider, {}) })] }));
}
