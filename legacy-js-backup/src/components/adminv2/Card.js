import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function Card({ title, subtitle, children, actions }) {
    return (_jsxs("section", { className: "card", children: [_jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { children: [title && _jsx("h3", { className: "text-lg font-semibold", children: title }), subtitle && _jsx("p", { className: "text-sm text-slate-600 dark:text-slate-300", children: subtitle })] }), actions && _jsx("div", { className: "shrink-0", children: actions })] }), _jsx("div", { className: "mt-4", children: children })] }));
}
