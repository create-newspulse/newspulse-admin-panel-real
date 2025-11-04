import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
const SectionBlock = ({ title, children }) => (_jsxs("section", { className: "bg-white dark:bg-slate-800 rounded-xl shadow p-5 mb-10 border border-slate-200 dark:border-slate-700", children: [_jsx("h2", { className: "text-xl font-semibold mb-4 text-slate-800 dark:text-white", children: title }), children] }));
const InspirationHub = () => {
    const [customEmbed, setCustomEmbed] = useState('');
    const [embedPreview, setEmbedPreview] = useState('');
    return (_jsxs("div", { className: "max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10", children: [_jsx("h1", { className: "text-3xl font-bold text-slate-900 dark:text-white mb-10", children: "\uD83C\uDF04 Inspiration Hub" }), _jsxs(SectionBlock, { title: "\uD83D\uDE81 DroneTV \u2013 Scenic Nature Relaxation", children: [_jsx("div", { className: "aspect-video w-full rounded overflow-hidden border border-gray-300", children: _jsx("iframe", { src: "https://www.youtube.com/embed/YVYNY6ez_uw", title: "DroneTV", allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture", allowFullScreen: true, className: "w-full h-full" }) }), _jsx("p", { className: "text-sm text-gray-500 mt-2", children: "\u2705 Auto embed from YouTube. For peaceful and safe viewing." })] }), _jsxs(SectionBlock, { title: "\u2728 Daily Wonders \u2013 Uplifting Visual Quotes", children: [_jsx("div", { className: "aspect-video w-full rounded overflow-hidden border border-gray-300", children: _jsx("iframe", { width: "560", height: "315", src: "https://www.youtube.com/embed/qtYGQT-9Sc4", frameBorder: "0", allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture", allowFullScreen: true, title: "Daily Wonder" }) }), _jsx("p", { className: "text-sm text-gray-500 mt-2", children: "\uD83C\uDF87 AI-powered visuals to brighten your day. Powered by safe YouTube embedding." })] }), _jsxs(SectionBlock, { title: "\u270D\uFE0F Embed Your Own Video (Manual)", children: [_jsx("textarea", { rows: 4, className: "w-full p-3 rounded border border-gray-300 text-sm font-mono", placeholder: "<iframe ...></iframe>", value: customEmbed, onChange: (e) => setCustomEmbed(e.target.value) }), _jsx("button", { className: "mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500", onClick: () => setEmbedPreview(customEmbed), children: "\u25B6\uFE0F Preview Embed" }), embedPreview && (_jsx("div", { className: "mt-6 aspect-video w-full rounded overflow-hidden border border-blue-500 shadow", children: (() => {
                            // runtime safety: only render preview in browser secure contexts
                            if (typeof window === 'undefined' || window.location.protocol === 'file:') {
                                return _jsx("div", { className: "text-sm text-red-600", children: "Preview blocked in this context." });
                            }
                            try {
                                const { extractIframeSrc, isHostAllowed } = require('../../lib/embedUtils');
                                const src = extractIframeSrc(embedPreview || '');
                                if (src && isHostAllowed(src))
                                    return _jsx("iframe", { title: "embed", src: src, width: "100%", height: "100%", frameBorder: 0, allowFullScreen: true });
                            }
                            catch (e) { }
                            const { sanitizeHtml } = require('../../lib/sanitize');
                            return _jsx("div", { dangerouslySetInnerHTML: { __html: sanitizeHtml(embedPreview || '') } });
                        })() }))] }), _jsx("p", { className: "text-xs text-center text-gray-400 mt-10 border-t pt-4", children: "\uD83D\uDCDC All videos are embedded via YouTube. We do not host, store, or monetize any external content. Embeds are used under public YouTube terms." })] }));
};
export default InspirationHub;
