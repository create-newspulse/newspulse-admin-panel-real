import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useEffect, useState } from 'react';
const ThemeContext = createContext(null);
export const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState('light');
    useEffect(() => {
        const saved = localStorage.getItem('theme') || 'light';
        setTheme(saved);
        document.documentElement.classList.toggle('dark', saved === 'dark');
    }, []);
    const toggleTheme = () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
        document.documentElement.classList.toggle('dark', newTheme === 'dark');
        localStorage.setItem('theme', newTheme);
    };
    return (_jsx(ThemeContext.Provider, { value: { theme, toggleTheme }, children: children }));
};
export const useTheme = () => useContext(ThemeContext);
