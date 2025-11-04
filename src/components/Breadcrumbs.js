import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useLocation, Link } from "react-router-dom";
import { FaChevronRight } from "react-icons/fa";
const Breadcrumbs = () => {
    const location = useLocation();
    const segments = location.pathname.split("/").filter(Boolean);
    const formatLabel = (segment) => {
        return decodeURIComponent(segment)
            .replaceAll("-", " ")
            .replace(/\b\w/g, (char) => char.toUpperCase());
    };
    return (_jsx("nav", { "aria-label": "Breadcrumb", className: "mb-4 text-sm", children: _jsxs("ol", { className: "flex flex-wrap items-center gap-1 text-gray-600 dark:text-gray-300", children: [_jsx("li", { children: _jsx(Link, { to: "/", className: "text-blue-600 dark:text-blue-400 hover:underline font-medium", children: "\uD83C\uDFE0 Home" }) }), segments.map((seg, i) => {
                    const path = "/" + segments.slice(0, i + 1).join("/");
                    const isLast = i === segments.length - 1;
                    return (_jsxs("li", { className: "flex items-center gap-1", children: [_jsx(FaChevronRight, { className: "text-gray-400 text-xs" }), isLast ? (_jsx("span", { className: "font-semibold text-gray-800 dark:text-white", children: formatLabel(seg) })) : (_jsx(Link, { to: path, className: "text-blue-600 dark:text-blue-400 hover:underline", children: formatLabel(seg) }))] }, i));
                })] }) }));
};
export default Breadcrumbs;
