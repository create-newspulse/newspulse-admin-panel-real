import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// ≡ƒôü src/pages/Profile.tsx
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
export default function Profile() {
    const { user } = useAuth();
    const [name, setName] = useState(user?.name || '');
    const [bio, setBio] = useState(user?.bio || '');
    const [avatar, setAvatar] = useState(user?.avatar || '');
    const [message, setMessage] = useState('');
    const handleSave = () => {
        // Simulate update
        setMessage('Γ£à Profile saved! (simulated)');
    };
    return (_jsxs("div", { className: "max-w-xl mx-auto p-6", children: [_jsx("h2", { className: "text-xl font-bold mb-4", children: "\uD83D\uDC64 Profile" }), _jsx("label", { className: "block mb-2 font-medium", children: "Name" }), _jsx("input", { className: "border w-full mb-4 px-3 py-2 rounded", value: name, onChange: (e) => setName(e.target.value) }), _jsx("label", { className: "block mb-2 font-medium", children: "Bio" }), _jsx("textarea", { className: "border w-full mb-4 px-3 py-2 rounded", value: bio, onChange: (e) => setBio(e.target.value) }), _jsx("label", { className: "block mb-2 font-medium", children: "Avatar URL" }), _jsx("input", { className: "border w-full mb-4 px-3 py-2 rounded", value: avatar, onChange: (e) => setAvatar(e.target.value) }), _jsx("button", { className: "bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-500", onClick: handleSave, children: "Save Changes" }), message && _jsx("p", { className: "mt-4 text-green-600", children: message })] }));
}
