import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createContext, useContext } from 'react';
import { Toaster, toast } from 'react-hot-toast';
const NotificationContext = createContext(undefined);
export const NotificationProvider = ({ children }) => {
    const success = (message) => toast.success(message, { duration: 3500 });
    const error = (message) => toast.error(message, { duration: 4500 });
    const info = (message) => toast(message, { duration: 3000 });
    return (_jsxs(NotificationContext.Provider, { value: { success, error, info }, children: [children, _jsx(Toaster, { position: "top-right" })] }));
};
export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
};
