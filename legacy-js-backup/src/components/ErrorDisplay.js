import { jsx as _jsx } from "react/jsx-runtime";
// src/components/ErrorDisplay.tsx
export default function ErrorDisplay({ error }) {
    if (!error)
        return null;
    return (_jsx("div", { className: "bg-red-100 text-red-700 border border-red-300 rounded p-2 mb-2", children: error === 'Too many requests'
            ? 'Γ¢ö Too many requests. Please wait and try again.'
            : error }));
}
