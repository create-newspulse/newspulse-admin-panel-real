import { useQuery } from '@tanstack/react-query';
import { listArticles } from '../../../lib/api/articles';

export default function DraftDeskPage(){
  const { data, isLoading } = useQuery({ queryKey:['articles','drafts'], queryFn: () => listArticles({ status: 'draft' }) });
  const items = (data?.data || []).filter((a:any) => a.status === 'draft');

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">📰 Draft Desk</h1>
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
          {items.map((a:any)=>(
            <tr key={a._id} className="border-t">
              <td className="p-2">{a.title}</td>
              <td className="p-2 text-center">{a.language}</td>
              <td className="p-2 text-center">{a.status}</td>
              <td className="p-2 flex gap-2 justify-center">
                <a href={`/admin/manage-news/${a._id}/edit`} className="btn-secondary">Edit</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
