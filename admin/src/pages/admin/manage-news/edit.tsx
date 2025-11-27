import React from 'react';
import { useParams } from 'react-router-dom';
import ArticleForm from '../../../components/news/ArticleForm';

export default function EditNewsPage(){
  const { id } = useParams();
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">✏️ Edit Article</h1>
      {id ? (
        <ArticleForm mode="edit" articleId={id} userRole="admin" />
      ) : (
        <div className="text-red-600">Missing article id in route.</div>
      )}
    </div>
  );
}
