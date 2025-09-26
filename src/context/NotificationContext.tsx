import React, { createContext, useContext, ReactNode } from 'react';
import { Toaster } from 'react-hot-toast'; // Example: if you use react-hot-toast

// Define your context type
interface NotificationContextType {
  // e.g., showSuccess: (message: string) => void;
  // e.g., showError: (message: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  // You would implement functions here to trigger toasts/notifications
  // const showSuccess = (message: string) => toast.success(message);
  // const showError = (message: string) => toast.error(message);

  return (
    <NotificationContext.Provider value={{ /* showSuccess, showError */ }}>
      {children}
      <Toaster position="top-right" /> {/* Place your Toaster here */}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};