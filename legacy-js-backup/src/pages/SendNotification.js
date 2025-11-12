import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// ≡ƒôü src/pages/SendNotification.tsx
import { useState } from 'react';
export default function SendNotification() {
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [status, setStatus] = useState('');
    const handleSend = async () => {
        if (!title || !body) {
            setStatus('ΓÜá∩╕Å Title and body required');
            return;
        }
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/notifications/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, body }),
            });
            const data = await res.json();
            setStatus(data.message);
        }
        catch (err) {
            console.error(err);
            setStatus('Γ¥î Failed to send notification');
        }
    };
    return (_jsxs("div", { className: "p-6 max-w-xl mx-auto", children: [_jsx("h1", { className: "text-2xl font-bold mb-4", children: "\uD83D\uDD14 Send Push Notification" }), _jsx("input", { type: "text", placeholder: "Notification Title", value: title, onChange: (e) => setTitle(e.target.value), className: "w-full mb-3 border p-2 rounded" }), _jsx("textarea", { placeholder: "Notification Message", value: body, onChange: (e) => setBody(e.target.value), rows: 4, className: "w-full mb-3 border p-2 rounded" }), _jsx("button", { onClick: handleSend, className: "bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded", children: "\uD83D\uDE80 Send Notification" }), status && _jsx("p", { className: "mt-4 text-sm text-green-600", children: status })] }));
}
