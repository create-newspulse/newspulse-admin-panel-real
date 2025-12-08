import { useState } from 'react';
import { useFounderActions } from '../hooks/useFounderActions';

export default function RollbackDryRunDialog() {
	const { rollback } = useFounderActions();
	const [open, setOpen] = useState(false);
	const [snapshotId, setSnapshotId] = useState<string>('');
	const [result, setResult] = useState<any>(null);
	async function run() {
		const r = await rollback(snapshotId, true);
		setResult(r);
	}
	return (
		<div>
			<button className="rounded px-3 py-1 bg-amber-600 text-white text-sm" onClick={()=>setOpen(v=>!v)}>
				{open ? 'Close Dry-Run' : 'Rollback (dry-run)'}
			</button>
			{open && (
				<div className="mt-2 p-3 border rounded bg-amber-50">
					<div className="flex gap-2 items-center mb-2">
						<input className="border px-2 py-1 rounded text-sm flex-1" placeholder="snapshotId"
									 value={snapshotId} onChange={e=>setSnapshotId(e.target.value)} />
						<button className="rounded px-3 py-1 bg-amber-700 text-white text-sm" onClick={run}>Dry-run</button>
					</div>
					{result && (
						<div className="text-xs">
							<div className="font-semibold mb-1">Diff preview</div>
							<ul className="list-disc pl-5">
								{(result.diff || []).map((d:any, i:number)=> (
									<li key={i}><code>{d.path}</code>: {String(d.from)} → {String(d.to)}</li>
								))}
							</ul>
						</div>
					)}
				</div>
			)}
		</div>
	);
}

