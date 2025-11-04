import { jsx as _jsx } from "react/jsx-runtime";
// src/context/SidebarContext.tsx
import { createContext, useContext, useState } from 'react';
const SidebarContext = createContext(undefined);
export const SidebarProvider = ({ children }) => {
    const [isOpen, setIsOpen] = useState(true);
    const toggleSidebar = () => setIsOpen(prev => !prev);
    return (_jsx(SidebarContext.Provider, { value: { isOpen, toggleSidebar }, children: children }));
};
export const useSidebar = () => {
    const context = useContext(SidebarContext);
    if (!context) {
        throw new Error('useSidebar must be used within a SidebarProvider');
    }
    return context;
};
