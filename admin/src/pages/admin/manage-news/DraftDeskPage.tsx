import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listArticles, deleteArticle, AdminArticle } from '../../../lib/api/articles';

export default function DraftDeskPage(){
  const qc = useQueryClient();
  const [toast, setToast] = useState<string|null>(null);
  const { data, isLoading } = useQuery({ queryKey:['articles','drafts'], queryFn: () => listArticles({ status: 'draft' }) });
  const items: AdminArticle[] = ((data?.data || []) as AdminArticle[]).filter((a) => a?.status === 'draft');

  async function onDelete(id: string){
    const ok = window.confirm('Delete this draft? This will move it to Deleted and it will not appear in Draft Desk or Manage News Drafts.');
    if (!ok) return;
    await deleteArticle(id);
    setToast('Draft deleted.');
    setTimeout(()=> setToast(null), 3000);
    qc.invalidateQueries({ queryKey:['articles'] });
    qc.invalidateQueries({ queryKey:['articles','drafts'] });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">📰 Draft Desk</h1>
      </div>
      {toast && <div className="mb-3 text-sm bg-green-100 text-green-700 px-3 py-2 rounded border border-green-200">{toast}</div>}
      {isLoading && <div>Loading...</div>}
      <table className="w-full text-sm border">
        <thead className="bg-slate-100">
          <tr>
            <th className="p-2 text-left">Title</th>
            <th className="p-2">Language</th>
            <th className="p-2">Status</th>
            <th className="p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((a: AdminArticle)=>(
            <tr key={a._id} className="border-t">
              <td className="p-2">{a.title}</td>
              <td className="p-2 text-center">{a.language}</td>
              <td className="p-2 text-center">{a.status}</td>
              <td className="p-2 flex gap-2 justify-center">
                <a href={`/admin/manage-news/${a._id}/edit`} className="btn-secondary">Edit</a>
                {a?.status === 'draft' && (
                  <button onClick={()=> onDelete(a._id)} className="btn-secondary">Delete draft</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
