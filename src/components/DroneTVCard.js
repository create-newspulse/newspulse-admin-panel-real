import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// ✅ Color map for tags
const moodTagColors = {
    '🧘 Calm': 'bg-blue-100 text-blue-800',
    '🌲 Nature': 'bg-green-100 text-green-800',
    '🏞️ Scenic': 'bg-indigo-100 text-indigo-800',
    '🚁 Aerial': 'bg-gray-100 text-gray-800',
    '🎵 Ambient': 'bg-purple-100 text-purple-800',
};
export default function DroneTVCard({ video }) {
    return (_jsxs("div", { className: "bg-white shadow rounded p-4 mb-4", children: [_jsx("h2", { className: "text-lg font-bold mb-2", children: video.title }), _jsx("div", { className: "my-3", children: (() => {
                    if (typeof window === 'undefined' || window.location.protocol === 'file:') {
                        return _jsx("div", { className: "text-sm text-red-600", children: "Preview blocked" });
                    }
                    try {
                        const { extractIframeSrc, isHostAllowed } = require('../lib/embedUtils');
                        const src = extractIframeSrc(video.embedCode || '');
                        if (src && isHostAllowed(src))
                            return _jsx("iframe", { title: video.title || 'video', src: src, width: "100%", height: "280", frameBorder: 0, allowFullScreen: true });
                    }
                    catch (e) { }
                    const { sanitizeHtml } = require('../lib/sanitize');
                    // eslint-disable-next-line react/no-danger
                    return _jsx("div", { dangerouslySetInnerHTML: { __html: sanitizeHtml(video.embedCode || '') } });
                })() }), _jsx("p", { className: "text-gray-700 text-sm mb-2", children: video.description }), _jsx("div", { className: "flex flex-wrap gap-2 mb-2", children: video.moodTags.map((tag, i) => (_jsx("span", { className: `text-xs font-medium px-2 py-1 rounded-full ${moodTagColors[tag] || 'bg-gray-100 text-gray-600'}`, children: tag }, i))) }), _jsxs("div", { className: "text-sm text-gray-500 mt-1", children: [_jsxs("span", { children: ["\uD83D\uDCCC Source: ", video.source || 'Unknown'] }), _jsx("br", {}), _jsxs("span", { children: ["\uD83C\uDFA5 Credit: ", video.credit || 'Admin Upload'] })] })] }));
}
