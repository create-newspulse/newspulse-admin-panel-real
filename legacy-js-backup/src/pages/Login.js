import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// ≡ƒôü src/pages/Login.tsx
// Redirect to the new magic-link auth page
import { useEffect } from 'react';
const Login = () => {
    useEffect(() => {
        window.location.replace('/auth');
    }, []);
    return (_jsx("div", { className: "min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4", children: _jsxs("div", { className: "text-center", children: [_jsx("h2", { className: "text-2xl font-semibold mb-2", children: "Redirecting to secure sign-in\u2026" }), _jsxs("p", { className: "text-gray-600", children: ["If nothing happens, ", _jsx("a", { className: "text-indigo-600 underline", href: "/auth", children: "click here" }), "."] })] }) }));
};
export default Login;
