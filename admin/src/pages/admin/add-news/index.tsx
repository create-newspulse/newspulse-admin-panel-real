import ArticleForm from '../../../components/news/ArticleForm';
import React from 'react';

export default function AddNewsPage(){
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">📝 Add Article</h1>
      <ArticleForm mode="create" userRole="admin" />
    </div>
  );
}
