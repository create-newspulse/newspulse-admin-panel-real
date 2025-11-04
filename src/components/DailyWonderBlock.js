import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const DailyWonderBlock = ({ quote, videoEmbedUrl, source, creator, }) => {
    // (Optional) Basic YouTube embed URL check
    const isYouTubeEmbed = /^https:\/\/www\.youtube\.com\/embed\//.test(videoEmbedUrl);
    const handleVoicePlay = () => {
        // Trigger voice reading logic here
        console.log("🔊 Play voice for Daily Wonder");
    };
    return (_jsx("div", { className: "bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-xl shadow-xl overflow-hidden mb-10 transition-all duration-300", children: _jsxs("div", { className: "p-6 space-y-4", children: [_jsx("h2", { className: "text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2", children: "\uD83C\uDF04 Daily Wonder" }), _jsxs("p", { className: "italic text-lg text-blue-700 dark:text-blue-300 leading-relaxed", children: ["\u201C", quote, "\u201D"] }), _jsx("div", { className: "aspect-video w-full rounded-lg overflow-hidden shadow-md border border-gray-200 dark:border-gray-700", children: isYouTubeEmbed ? (_jsx("iframe", { src: videoEmbedUrl, title: "Daily Wonder Video", "aria-label": "Daily Wonder YouTube Video", className: "w-full h-full", allow: "autoplay; encrypted-media", allowFullScreen: true, loading: "lazy" })) : (_jsx("div", { className: "text-red-500 text-center p-4", children: "Invalid video link" })) }), _jsx("button", { onClick: handleVoicePlay, "aria-label": "Listen to this wonder", className: "bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md font-medium shadow-sm transition", children: "\uD83D\uDD08 Listen to This Wonder" }), _jsxs("p", { className: "text-sm text-gray-500 dark:text-gray-400 mt-2", children: ["\uD83D\uDCF9 Source:", " ", _jsx("a", { href: source, target: "_blank", rel: "noopener noreferrer", className: "underline hover:text-blue-600 dark:hover:text-blue-300", children: creator })] })] }) }));
};
export default DailyWonderBlock;
