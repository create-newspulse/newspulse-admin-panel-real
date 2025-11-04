import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Example: src/pages/SystemHealth.tsx
import { useEffect, useState } from 'react';
import api from '../utils/api';
const SystemHealth = () => {
    const [health, setHealth] = useState(null);
    useEffect(() => {
        api.get('/safezone/system-health')
            .then(res => setHealth(res.data))
            .catch(err => console.error('❌ System Health Error:', err.message));
    }, []);
    return (_jsxs("div", { className: "p-6", children: [_jsx("h1", { className: "text-xl font-bold mb-4", children: "System Health Check" }), _jsx("pre", { children: JSON.stringify(health, null, 2) })] }));
};
export default SystemHealth;
