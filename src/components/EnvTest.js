import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const EnvTest = () => {
    const demoMode = import.meta.env.VITE_DEMO_MODE;
    const apiUrl = import.meta.env.VITE_API_BASE_URL;
    const mode = import.meta.env.MODE;
    const dev = import.meta.env.DEV;
    const prod = import.meta.env.PROD;
    const isVercel = window.location.hostname.includes('vercel.app');
    const isLocalhost = window.location.hostname === 'localhost';
    return (_jsxs("div", { style: {
            position: 'fixed',
            top: 10,
            right: 10,
            background: '#000',
            color: '#0f0',
            padding: '10px',
            fontSize: '12px',
            fontFamily: 'monospace',
            borderRadius: '5px',
            zIndex: 9999,
            maxWidth: '300px'
        }, children: [_jsx("div", { children: "\uD83D\uDD27 Environment Debug" }), _jsxs("div", { children: ["VITE_DEMO_MODE: ", demoMode || 'undefined'] }), _jsxs("div", { children: ["API_URL: ", apiUrl || 'undefined'] }), _jsxs("div", { children: ["MODE: ", mode] }), _jsxs("div", { children: ["DEV: ", dev ? 'true' : 'false'] }), _jsxs("div", { children: ["PROD: ", prod ? 'true' : 'false'] }), _jsx("div", { children: "---" }), _jsxs("div", { children: ["Hostname: ", window.location.hostname] }), _jsxs("div", { children: ["Is Vercel: ", isVercel ? 'YES' : 'NO'] }), _jsxs("div", { children: ["Is Localhost: ", isLocalhost ? 'YES' : 'NO'] }), _jsx("div", { children: "---" }), _jsxs("div", { children: ["Demo Logic: ", (demoMode !== 'false' && isVercel) ? 'ENABLED' : 'DISABLED'] })] }));
};
export default EnvTest;
