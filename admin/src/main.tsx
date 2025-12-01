import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AppLayout from './pages/AppLayout';
import AddNewsPage from './pages/admin/add-news';
import ManageNewsPage from './pages/admin/manage-news';
import EditNewsPage from './pages/admin/manage-news/edit';
import DraftDeskPage from './pages/admin/manage-news/DraftDeskPage';
import CommunityReporterPage from './pages/admin/community-reporter';
import './styles.css';
import { AdminAuthProvider } from './context/AdminAuthContext';

const qc = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <AdminAuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Single /admin parent hosting all admin pages */}
          <Route path='/admin' element={<AppLayout />}>
            <Route index element={<Navigate to='/admin/manage-news' replace />} />
            <Route path='login' element={<Navigate to='/admin/manage-news' replace />} />
            <Route path='dashboard' element={<Navigate to='/admin/manage-news' replace />} />
            <Route path='add-news' element={<AddNewsPage />} />
            <Route path='manage-news' element={<ManageNewsPage />} />
            <Route path='drafts' element={<DraftDeskPage />} />
            <Route path='manage-news/:id/edit' element={<EditNewsPage />} />
            <Route path='community-reporter' element={<CommunityReporterPage />} />
            <Route path='*' element={<Navigate to='/admin/manage-news' replace />} />
          </Route>
          {/* Any other root-level path redirects into admin space */}
          <Route path='*' element={<Navigate to='/admin/manage-news' replace />} />
        </Routes>
      </BrowserRouter>
      </AdminAuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
