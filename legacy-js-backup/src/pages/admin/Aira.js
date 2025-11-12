import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import AiraVoicePlayer from '../../components/AiraVoicePlayer';
const AiraPage = () => {
    return (_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold mb-4", children: "AIRA \u2013 AI Anchor Voice Bulletins" }), _jsx("p", { className: "opacity-80 mb-4", children: "Generate and play hourly voice bulletins. If server TTS is not configured, playback uses your browser voice." }), _jsx(AiraVoicePlayer, {})] }));
};
export default AiraPage;
