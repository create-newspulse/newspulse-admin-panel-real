import React from 'react';
import { Navigate, useParams } from 'react-router-dom';

export default function LegacyArticleEditRedirect() {
  const { id } = useParams();
  const safeId = encodeURIComponent(String(id || ''));
  return <Navigate to={`/admin/articles/${safeId}/edit`} replace />;
}
