import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// ≡ƒôü File: src/pages/admin/EmbedManager.tsx
// Γ£à Embed Manager with TED Youth Zone, Manual Embed, and Section Assignment
import { useState } from 'react';
import AdminShell from '../../components/adminv2/AdminShell';
import { extractIframeSrc, isHostAllowed } from '../../lib/embedUtils';
const SectionBlock = ({ title, children }) => (_jsxs("div", { className: "bg-white dark:bg-slate-800 rounded-xl shadow p-5 mb-8 border border-slate-200 dark:border-slate-700", children: [_jsx("h2", { className: "text-xl font-semibold mb-4 text-slate-800 dark:text-white", children: title }), children] }));
const EmbedManager = () => {
    const [customEmbed, setCustomEmbed] = useState('');
    // embedSrc holds a safe iframe src URL extracted from user input
    const [embedSrc, setEmbedSrc] = useState('');
    const [embedError, setEmbedError] = useState('');
    // embed utils handle extraction and host allowlist (configurable via VITE_EMBED_ALLOWLIST)
    return (_jsx(AdminShell, { children: _jsxs("div", { className: "max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10", children: [_jsx("h1", { className: "text-3xl font-bold text-slate-900 dark:text-white mb-10", children: "\uD83E\uDDE9 Embed Manager" }), _jsxs(SectionBlock, { title: "\uD83C\uDF93 Curated TED Youth Embeds", children: [_jsxs("ul", { className: "list-disc list-inside text-sm text-blue-700", children: [_jsx("li", { children: _jsx("a", { href: "https://www.youtube.com/embed/QtyT8G9b2Xo", target: "_blank", rel: "noopener noreferrer", className: "hover:underline", children: "\uD83D\uDCCC Why you will fail to have a great career \u2014 Larry Smith" }) }), _jsx("li", { children: _jsx("a", { href: "https://www.youtube.com/embed/2zrtHt3bBmQ", target: "_blank", rel: "noopener noreferrer", className: "hover:underline", children: "\uD83D\uDCCC The power of believing you can improve \u2014 Carol Dweck" }) }), _jsx("li", { children: _jsx("a", { href: "https://www.youtube.com/embed/16p9YRF0l-g", target: "_blank", rel: "noopener noreferrer", className: "hover:underline", children: "\uD83D\uDCCC What adults can learn from kids \u2014 Adora Svitak" }) }), _jsx("li", { children: _jsx("a", { href: "https://www.youtube.com/embed/16p9YRF0l-g", target: "_blank", rel: "noopener noreferrer", className: "hover:underline", children: "\uD83D\uDCCC How to build your creative confidence \u2014 David Kelley" }) }), _jsx("li", { children: _jsx("a", { href: "https://www.youtube.com/embed/_QdPW8JrYzQ", target: "_blank", rel: "noopener noreferrer", className: "hover:underline", children: "\uD83D\uDCCC This is what happens when you reply to spam email \u2014 James Veitch" }) })] }), _jsx("p", { className: "text-xs mt-2 text-gray-500 italic", children: "\uD83D\uDCCE All TED content is embedded via official YouTube source. Copyright belongs to TED." })] }), _jsxs(SectionBlock, { title: "\u270D\uFE0F Paste Your Own Embed Code + Assign Section", children: [_jsx("textarea", { rows: 4, className: "w-full p-3 rounded border border-gray-300 text-sm font-mono", placeholder: "<iframe ...></iframe>", value: customEmbed, onChange: (e) => setCustomEmbed(e.target.value) }), _jsxs("div", { className: "mt-3", children: [_jsx("label", { className: "block mb-2 font-medium text-sm", children: "\uD83C\uDFAF Assign to Section:" }), _jsxs("select", { className: "w-full p-2 border border-gray-300 rounded text-sm", children: [_jsx("option", { children: "\uD83C\uDF93 TED Youth" }), _jsx("option", { children: "\uD83D\uDE81 DroneTV" }), _jsx("option", { children: "\u2728 Daily Wonders" }), _jsx("option", { children: "\uD83D\uDCFA DD News Live" }), _jsx("option", { children: "\uD83C\uDFDB\uFE0F Sansad TV" })] })] }), _jsx("button", { className: "mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500", onClick: () => {
                                setEmbedError('');
                                setEmbedSrc('');
                                const src = extractIframeSrc(customEmbed);
                                if (!src) {
                                    setEmbedError('Unable to extract a valid iframe src from the input. Paste a full iframe or embed URL.');
                                    return;
                                }
                                if (!isHostAllowed(src)) {
                                    setEmbedError('Embed host not allowed. Only YouTube, Vimeo, TED, AirVuz and trusted providers are permitted.');
                                    return;
                                }
                                setEmbedSrc(src);
                            }, children: "\u25B6\uFE0F Preview Embed" }), embedError && _jsx("p", { className: "text-sm text-red-600 mt-3", children: embedError }), embedSrc && (_jsx("div", { className: "mt-6 aspect-video w-full rounded overflow-hidden border border-blue-500 shadow", children: _jsx("iframe", { title: "Embed preview", src: embedSrc, width: "100%", height: "100%", frameBorder: 0, allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture", allowFullScreen: true }) }))] }), _jsx("p", { className: "text-xs text-center text-gray-400 mt-10 border-t pt-4", children: "\uD83D\uDCDC All embeds are from YouTube, TED, AirVuz or other trusted public sources. No videos are hosted on News Pulse. This system follows legal, non-monetized embedding standards." })] }) }));
};
export default EmbedManager;
