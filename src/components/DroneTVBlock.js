import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const moodTagColors = {
    "🧘 Calm": "bg-blue-100 text-blue-800",
    "🌲 Nature": "bg-green-100 text-green-800",
    "🏞️ Scenic": "bg-indigo-100 text-indigo-800",
    "🚁 Aerial": "bg-gray-100 text-gray-800",
    "🎵 Ambient": "bg-purple-100 text-purple-800",
};
const DroneTVBlock = ({ video }) => {
    return (_jsxs("div", { className: "mb-8 border rounded-lg p-4 shadow-md bg-white dark:bg-slate-900", children: [_jsx("div", { children: (() => {
                    if (typeof window === 'undefined' || window.location.protocol === 'file:') {
                        return _jsx("div", { className: "text-sm text-red-600", children: "Preview blocked" });
                    }
                    try {
                        const { extractIframeSrc, isHostAllowed } = require('./../lib/embedUtils');
                        const src = extractIframeSrc(video.embedCode || '');
                        if (src && isHostAllowed(src))
                            return _jsx("iframe", { title: video.title || 'video', src: src, width: "100%", height: "320", frameBorder: 0, allowFullScreen: true });
                    }
                    catch (e) { }
                    const { sanitizeHtml } = require('./../lib/sanitize');
                    // eslint-disable-next-line react/no-danger
                    return _jsx("div", { dangerouslySetInnerHTML: { __html: sanitizeHtml(video.embedCode || '') } });
                })() }), _jsx("div", { className: "mt-4 text-lg font-semibold text-slate-900 dark:text-white", children: video.title }), _jsx("div", { className: "mt-2 flex flex-wrap gap-2", children: video.moodTags.map((tag) => (_jsx("span", { className: `px-3 py-1 text-sm rounded-full font-medium ${moodTagColors[tag] || "bg-gray-200 text-gray-700"}`, children: tag }, tag))) })] }));
};
export default DroneTVBlock;
