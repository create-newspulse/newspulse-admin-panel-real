import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from "react";
export default function LoginPage() {
    useEffect(() => {
        window.location.replace('/auth');
    }, []);
    return (_jsxs("div", { style: { padding: 24 }, children: [_jsx("h2", { children: "Redirecting to secure sign-in\u2026" }), _jsxs("p", { children: ["If you are not redirected, ", _jsx("a", { href: "/auth", children: "click here" }), "."] })] }));
}
