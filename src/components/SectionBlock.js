import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const SectionBlock = ({ title, children }) => (_jsxs("section", { className: "bg-white dark:bg-slate-800 rounded-xl shadow p-5 mb-8 border border-slate-200 dark:border-slate-700", children: [title && _jsx("h2", { className: "text-xl font-semibold mb-4 text-slate-800 dark:text-white", children: title }), children] }));
export default SectionBlock;
