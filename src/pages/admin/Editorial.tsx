import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { listArticles, type Article } from '@/lib/api/articles';

const STATUSES = [
	{ key: 'all', label: 'All Editorial Articles' },
	{ key: 'draft', label: 'Editorial Drafts' },
	{ key: 'scheduled', label: 'Scheduled' },
	{ key: 'published', label: 'Published' },
	{ key: 'archived', label: 'Archived' },
] as const;

function getArticleStatus(article: Article): string {
	return String((article as any)?.status || (article as any)?.state || (article as any)?.publishStatus || 'draft').trim().toLowerCase();
}

export default function Editorial() {
	const articlesQuery = useQuery({
		queryKey: ['editorial-desk', 'articles'],
		queryFn: () => listArticles({ category: 'editorial', status: 'all', page: 1, limit: 250, sort: '-updatedAt' }),
	});

	const rows: Article[] = Array.isArray((articlesQuery.data as any)?.rows)
		? (articlesQuery.data as any).rows
		: [];

	const counts = STATUSES.reduce<Record<string, number>>((acc, item) => {
		if (item.key === 'all') acc[item.key] = typeof (articlesQuery.data as any)?.total === 'number' ? (articlesQuery.data as any).total : rows.length;
		else acc[item.key] = rows.filter((article) => getArticleStatus(article) === item.key).length;
		return acc;
	}, {});

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-bold mb-2">Editorial Desk</h1>
				<p className="text-sm text-slate-600 max-w-3xl">
					Manage Editorial articles and Special Stories written by the Founder or authorised Editors.
				</p>
			</div>

			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
				{STATUSES.map((item) => (
					<div key={item.key} className="rounded-lg border border-slate-200 bg-white p-4">
						<div className="text-xs font-semibold uppercase text-slate-500">{item.label}</div>
						<div className="mt-2 text-3xl font-bold text-slate-900">
							{articlesQuery.isLoading ? '...' : counts[item.key] ?? 0}
						</div>
					</div>
				))}
			</div>

			{articlesQuery.isError ? (
				<div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
					Editorial counts could not be loaded. The article workflows below are still available.
				</div>
			) : null}

			<div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
				<Link className="rounded-lg border border-slate-200 bg-white p-4 hover:bg-slate-50" to="/admin/add-news?category=editorial">
					<div className="text-sm font-semibold text-slate-900">Create Editorial / Special Story</div>
					<div className="mt-1 text-xs text-slate-600">Open Add News with Editorial selected.</div>
				</Link>
				<Link className="rounded-lg border border-slate-200 bg-white p-4 hover:bg-slate-50" to="/draft-desk?category=editorial">
					<div className="text-sm font-semibold text-slate-900">Review Editorial Drafts</div>
					<div className="mt-1 text-xs text-slate-600">Filter Draft Desk to Editorial category drafts.</div>
				</Link>
				<Link className="rounded-lg border border-slate-200 bg-white p-4 hover:bg-slate-50" to="/admin/articles?category=editorial">
					<div className="text-sm font-semibold text-slate-900">Manage Editorial Articles</div>
					<div className="mt-1 text-xs text-slate-600">Use the existing Manage News workflow.</div>
				</Link>
				<a className="rounded-lg border border-slate-200 bg-white p-4 hover:bg-slate-50" href="https://www.newspulse.co.in/editorial" target="_blank" rel="noreferrer">
					<div className="text-sm font-semibold text-slate-900">View Public Editorial Page</div>
					<div className="mt-1 text-xs text-slate-600">Open the live Editorial page.</div>
				</a>
			</div>
		</div>
	);
}

