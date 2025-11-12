import { jsx as _jsx } from "react/jsx-runtime";
// ≡ƒôü src/context/DarkModeContext.tsx
import { createContext, useContext, useState, useEffect } from 'react';
const DarkModeContext = createContext(undefined);
export const useDarkMode = () => {
    const context = useContext(DarkModeContext);
    if (!context)
        throw new Error('useDarkMode must be used inside DarkModeProvider');
    return context;
};
export const DarkModeProvider = ({ children }) => {
    const [isDark, setIsDark] = useState(() => {
        return localStorage.getItem('theme') === 'dark';
    });
    const toggleDark = () => {
        const newMode = !isDark;
        setIsDark(newMode);
        localStorage.setItem('theme', newMode ? 'dark' : 'light');
    };
    useEffect(() => {
        document.documentElement.classList.toggle('dark', isDark);
    }, [isDark]);
    return (_jsx(DarkModeContext.Provider, { value: { isDark, toggleDark }, children: children }));
};
