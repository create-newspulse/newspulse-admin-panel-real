import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// ≡ƒôü src/pages/LockedPage.tsx
import { FaLock } from 'react-icons/fa';
export default function LockedPage() {
    return (_jsxs("div", { className: "min-h-[70vh] flex flex-col items-center justify-center text-center p-8", children: [_jsx(FaLock, { className: "text-5xl text-red-500 mb-4" }), _jsx("h1", { className: "text-2xl font-bold mb-2 text-red-600", children: "\uD83D\uDD12 Admin Lockdown Active" }), _jsx("p", { className: "text-gray-600 dark:text-gray-300 max-w-xl", children: "This section of the Admin Panel is currently under lockdown. Only the founder can disable lockdown mode from the Founder Control Zone in the admin settings." })] }));
}
