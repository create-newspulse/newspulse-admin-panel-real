export type Alert = { id: string; level: 'info'|'warn'|'error'; title: string; message: string; ts: string };

export function mockStats() {
  // lightweight randomizer to simulate movement
  const base = (seed: number) => Math.max(0, Math.round(seed + (Math.random() * 10 - 5)));
  return {
    totalArticles: base(1200),
    pendingArticles: base(7),
    activePolls: base(3),
    traffic24h: base(34000),
    flags: base(2),
    complianceIssues: base(1),
  };
}

export function mockAlerts(): Alert[] {
  const now = Date.now();
  const sample = [
    { id: 'a1', level: 'info' as const, title: 'AI Engine', message: 'Model updated to gpt-4o-mini', ts: new Date(now - 1000 * 60 * 2).toISOString() },
    { id: 'a2', level: 'warn' as const, title: 'Compliance', message: '2 articles missing PTI source', ts: new Date(now - 1000 * 60 * 8).toISOString() },
    { id: 'a3', level: 'error' as const, title: 'Security', message: 'Abnormal login attempts detected', ts: new Date(now - 1000 * 60 * 14).toISOString() },
  ];
  return sample;
}
