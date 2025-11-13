import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AppLayout from './pages/AppLayout';
import AddNewsPage from './pages/admin/add-news';
import ManageNewsPage from './pages/admin/manage-news';
import './styles.css';

const qc = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Routes>
          <Route path='/' element={<AppLayout />}>
            <Route index element={<Navigate to='/admin/manage-news' replace />} />
            {/* Canonical admin shortcuts and legacy paths */}
            <Route path='admin' element={<Navigate to='/admin/manage-news' replace />} />
            <Route path='admin/login' element={<Navigate to='/admin/manage-news' replace />} />
            <Route path='admin/dashboard' element={<Navigate to='/admin/manage-news' replace />} />
            <Route path='admin/add-news' element={<AddNewsPage />} />
            <Route path='admin/manage-news' element={<ManageNewsPage />} />
            {/* Fallback for any unknown path within this SPA */}
            <Route path='*' element={<Navigate to='/admin/manage-news' replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
