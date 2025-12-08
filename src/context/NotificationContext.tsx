import React, { createContext, useContext, ReactNode } from 'react';
import { Toaster, toast } from 'react-hot-toast';

// Define your context type
interface NotificationContextType {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const success = (message: string) => toast.success(message, { duration: 3500 });
  const error = (message: string) => toast.error(message, { duration: 4500 });
  const info = (message: string) => toast(message, { duration: 3000 });

  return (
    <NotificationContext.Provider value={{ success, error, info }}>
      {children}
      <Toaster position="top-right" />
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