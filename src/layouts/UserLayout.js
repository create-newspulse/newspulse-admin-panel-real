import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import LanguageDropdown from '../components/LanguageDropdown';
export default function UserLayout({ children }) {
    return (_jsxs("div", { className: "min-h-screen bg-white dark:bg-slate-900", children: [_jsxs("header", { className: "bg-slate-900 text-white px-6 py-4 flex justify-between items-center", children: [_jsx("h1", { className: "text-lg font-bold", children: "\uD83C\uDF0D News Pulse" }), _jsx(LanguageDropdown, {})] }), _jsx("main", { className: "p-6", children: children })] }));
}
