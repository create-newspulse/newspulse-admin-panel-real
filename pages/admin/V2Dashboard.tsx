import React from 'react';
import AdminShell from '../../src/components/adminv2/AdminShell';
import KPIStat from '../../src/components/adminv2/KPIStat';
import Card from '../../src/components/adminv2/Card';
import Table from '../../src/components/adminv2/Table';

export default function V2Dashboard() {
  const kpis = [
    { label: 'Stories Today', value: '128', delta: '+12% WoW', tone: 'blue' as const },
    { label: 'Breaking Alerts', value: '24', delta: '+4 new', tone: 'amber' as const },
    { label: 'Embeds Reviewed', value: '73', delta: '98% clean', tone: 'green' as const },
    { label: 'Flagged Items', value: '5', delta: '-2 this hour', tone: 'rose' as const },
  ];

  type Row = { id: number; title: string; section: string; author: string; status: string; time: string };
  const rows: Row[] = [
    { id: 1, title: 'Parliament passes new media bill', section: 'Politics', author: 'Aarav', status: 'Published', time: '10m ago' },
    { id: 2, title: 'Tech giants unveil AI alliance', section: 'Technology', author: 'Mira', status: 'Review', time: '25m ago' },
    { id: 3, title: 'Cyclone alert issued for coast', section: 'Weather', author: 'Kabir', status: 'Draft', time: '40m ago' },
  ];

  return (
    <AdminShell>
      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(k => (
          <KPIStat key={k.label} {...k} />
        ))}
      </div>

      {/* Trend & Queue */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Realtime Traffic" subtitle="Last 30 minutes">
          {/* Simple sparkline with SVG */}
          <svg viewBox="0 0 300 80" className="w-full h-24">
            <polyline fill="none" stroke="rgb(59,130,246)" strokeWidth="3" points="0,60 20,50 40,55 60,35 80,40 100,20 120,25 140,15 160,28 180,18 200,26 220,22 240,30 260,24 280,28 300,20"/>
          </svg>
          <div className="text-sm text-slate-500 dark:text-slate-400">Peak 1.8k viewers · Avg 1.1k/min</div>
        </Card>

        <Card title="Tasks" subtitle="Editorial queue" actions={<button className="btn">New Task</button>}>
          <ul className="space-y-2">
            <li className="flex items-center justify-between"><span>Review election explainer</span><span className="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-800">Today</span></li>
            <li className="flex items-center justify-between"><span>Push DroneTV package</span><span className="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-800">+2h</span></li>
            <li className="flex items-center justify-between"><span>Check vimeo embeds</span><span className="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-800">This evening</span></li>
          </ul>
        </Card>

        <Card title="System Health" subtitle="Services">
          <div className="grid grid-cols-3 gap-3 text-center">
            {['API','AI','Uploads'].map((s,i) => (
              <div key={s} className="p-4 rounded-xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
                <div className="text-xs text-slate-500 dark:text-slate-400">{s}</div>
                <div className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">Online</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Latest Articles */}
      <div className="mt-6">
        <Card title="Latest Articles" subtitle="Recently updated">
          <Table<Row>
            rows={rows}
            columns={[
              { key: 'title', header: 'Title' },
              { key: 'section', header: 'Section' },
              { key: 'author', header: 'Author' },
              { key: 'status', header: 'Status', render: (r) => (
                <span className={`px-2 py-1 rounded text-xs ${r.status==='Published' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-800/30 dark:text-emerald-200' : r.status==='Review' ? 'bg-amber-100 text-amber-800 dark:bg-amber-800/30 dark:text-amber-200' : 'bg-slate-100 text-slate-800 dark:bg-slate-700/60 dark:text-slate-200'}`}>{r.status}</span>
              )},
              { key: 'time', header: 'Updated' },
            ]}
          />
        </Card>
      </div>
    </AdminShell>
  );
}
