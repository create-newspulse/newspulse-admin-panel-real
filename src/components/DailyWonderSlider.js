import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import Slider from "react-slick";
import axios from "axios";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import { speak } from "../lib/voicePlayer";
const DailyWonderSlider = () => {
    const [wonders, setWonders] = useState([]);
    const [selectedLang, setSelectedLang] = useState("en");
    const [bgAudio, setBgAudio] = useState(null);
    useEffect(() => {
        axios
            .get(`${import.meta.env.VITE_API_URL}/daily-wonder`)
            .then((res) => {
            const fetched = res.data.data;
            if (res.data.success) {
                setWonders(Array.isArray(fetched) ? fetched : [fetched]);
            }
            else {
                console.warn("⚠️ API responded without success flag.");
            }
        })
            .catch((err) => console.error("❌ Failed to load wonders:", err));
    }, []);
    const playNarration = (text, lang) => {
        speak(text, lang);
    };
    const handleMusicPlay = (url) => {
        if (!url)
            return;
        if (bgAudio)
            bgAudio.pause();
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
    return (_jsx("div", { className: "bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-xl shadow-xl mb-10 transition-all duration-300", children: _jsxs("div", { className: "p-6", children: [_jsxs("div", { className: "flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-3", children: [_jsx("h2", { className: "text-2xl font-bold text-gray-800 dark:text-white", children: "\uD83C\uDF04 Daily Wonders" }), _jsxs("select", { className: "bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-sm rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-300", value: selectedLang, onChange: (e) => setSelectedLang(e.target.value), children: [_jsx("option", { value: "en", children: "\uD83C\uDF10 English" }), _jsx("option", { value: "hi", children: "\uD83C\uDDEE\uD83C\uDDF3 Hindi" }), _jsx("option", { value: "gu", children: "\uD83C\uDDEE\uD83C\uDDF3 Gujarati" })] })] }), wonders.length === 0 ? (_jsx("div", { className: "text-center text-gray-500 dark:text-gray-400 py-10", children: "No wonders available right now." })) : (_jsx(Slider, { ...settings, children: wonders.map((item, index) => (_jsxs("div", { className: "px-2 sm:px-4", children: [_jsxs("p", { className: "italic text-lg text-blue-700 dark:text-blue-300 mb-4 leading-relaxed", children: ["\u201C", item.quote, "\u201D"] }), _jsxs("div", { className: "flex flex-wrap gap-3 mb-4", children: [_jsx("button", { onClick: () => playNarration(item.quote, selectedLang), className: "px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-sm transition", children: "\uD83D\uDD08 Narrate" }), item.musicUrl && (_jsx("button", { onClick: () => handleMusicPlay(item.musicUrl), className: "px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-md text-sm transition", children: "\uD83C\uDFB5 Play Music" }))] }), _jsx("div", { className: "aspect-video rounded-lg overflow-hidden shadow-md border border-gray-200 dark:border-gray-700 mb-3", children: _jsx("iframe", { src: item.videoEmbedUrl, title: `Wonder ${index}`, className: "w-full h-full", allow: "autoplay; encrypted-media", allowFullScreen: true, loading: "lazy" }) }), _jsxs("p", { className: "text-sm text-gray-600 dark:text-gray-400", children: ["\uD83D\uDCDA ", _jsx("strong", { children: item.category }), " \u2022 By", " ", _jsx("a", { href: item.source, target: "_blank", rel: "noopener noreferrer", className: "underline hover:text-blue-600 dark:hover:text-blue-300", children: item.creator })] })] }, index))) }))] }) }));
};
export default DailyWonderSlider;
