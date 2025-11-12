import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useLanguage } from '../context/LanguageContext';
const WeatherStrip = () => {
    const { selectedLanguage } = useLanguage();
    // Dummy data (replace with live API response in future)
    const weather = {
        icon: '01d', // Clear Sky (OpenWeather icon code)
        temp: 34, // Temperature in Celsius
        descriptions: {
            English: 'Clear Sky',
            Hindi: 'αñ╕αÑìαñ╡αñÜαÑìαñ¢ αñåαñòαñ╛αñ╢',
            Gujarati: 'α¬Üα½ïα¬ûα½ìα¬ûα½üα¬é α¬åα¬òα¬╛α¬╢',
        },
    };
    const iconUrl = `https://openweathermap.org/img/wn/${weather.icon}.png`;
    return (_jsxs("div", { className: "bg-blue-100 text-blue-900 dark:bg-gray-800 dark:text-white text-sm py-2 px-4 flex justify-between items-center", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("img", { src: iconUrl, alt: "Weather Icon", className: "w-6 h-6" }), _jsxs("span", { className: "font-medium", children: [weather.temp, "\u00B0C \u2013 ", weather.descriptions[selectedLanguage]] })] }), _jsx("span", { className: "text-xs", children: "\uD83D\uDCCD Ahmedabad" })] }));
};
export default WeatherStrip;
