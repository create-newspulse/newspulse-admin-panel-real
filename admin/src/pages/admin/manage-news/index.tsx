import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listArticles, archiveArticle, restoreArticle, deleteArticle, AdminArticle } from '../../../lib/api/articles';

export default function ManageNewsPage(){
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey:['articles'], queryFn: () => listArticles() });
  const items: AdminArticle[] = (data?.data || []) as AdminArticle[];

  // Hide community-sourced drafts from Manage News list (affects implicit "All" view here)
  const filteredItems = useMemo(()=>
    (items || []).filter(a => !( (a?.source === 'community') && (a?.status === 'draft') )),
  [items]);

  async function act(id:string, action:'archive'|'restore'|'delete') {
    if (action==='archive') await archiveArticle(id);
    if (action==='restore') await restoreArticle(id);
    if (action==='delete') await deleteArticle(id);
    qc.invalidateQueries({ queryKey:['articles'] });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">📁 Manage News</h1>
        <div className="flex gap-2">
          <a href="/admin/add-news" className="btn">Add</a>
          <button onClick={()=> qc.invalidateQueries({queryKey:['articles']})} className="btn-secondary">Refresh</button>
        </div>
      </div>
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
          {filteredItems.map((a: AdminArticle)=>(
            <tr key={a._id} className="border-t">
              <td className="p-2">{a.title}</td>
              <td className="p-2 text-center">{a.language}</td>
              <td className="p-2 text-center">{a.status}</td>
              <td className="p-2 flex gap-2 justify-center">
                <a href={`/admin/manage-news/${a._id}/edit`} className="btn-secondary">Edit</a>
                {a.status!=='archived' && a.status!=='deleted' && <button onClick={()=> act(a._id,'archive')} className="btn-secondary">Archive</button>}
                {a.status==='archived' && <button onClick={()=> act(a._id,'restore')} className="btn-secondary">Restore</button>}
                {a.status!=='deleted' && <button onClick={()=> act(a._id,'delete')} className="btn-secondary">Delete</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
