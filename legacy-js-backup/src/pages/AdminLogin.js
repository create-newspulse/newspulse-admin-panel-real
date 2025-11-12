import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from "react";
export default function AdminLogin() {
    useEffect(() => {
        window.location.replace('/auth');
    }, []);
    return (_jsx("div", { className: "min-h-screen flex justify-center items-center bg-gray-50", children: _jsxs("div", { className: "text-center", children: [_jsx("h1", { className: "text-2xl font-semibold mb-2", children: "Redirecting to secure sign-in\u2026" }), _jsxs("p", { className: "text-gray-600", children: ["If you are not redirected, ", _jsx("a", { className: "text-blue-600 underline", href: "/auth", children: "click here" }), "."] })] }) }));
}
