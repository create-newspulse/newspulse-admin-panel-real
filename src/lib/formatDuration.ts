export function formatDurationShort(inputSeconds: unknown): string {
  const n = typeof inputSeconds === 'number' ? inputSeconds : (typeof inputSeconds === 'string' ? Number(inputSeconds) : NaN);
  if (!Number.isFinite(n) || n < 0) return '—';
  const s = Math.round(n);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m < 60) return `${m}m ${r.toString().padStart(2, '0')}s`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}h ${mm.toString().padStart(2, '0')}m`;
}

export function formatNumberCompact(input: unknown): string {
  const n = typeof input === 'number' ? input : (typeof input === 'string' ? Number(input) : NaN);
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs < 1000) return String(Math.round(n));
  if (abs < 1_000_000) return `${(n / 1000).toFixed(abs < 10_000 ? 1 : 0)}k`;
  if (abs < 1_000_000_000) return `${(n / 1_000_000).toFixed(abs < 10_000_000 ? 1 : 0)}M`;
  return `${(n / 1_000_000_000).toFixed(1)}B`;
}

export function normalizePercent(input: unknown): number | null {
  const n = typeof input === 'number' ? input : (typeof input === 'string' ? Number(input) : NaN);
  if (!Number.isFinite(n)) return null;
  if (n <= 1) return Math.max(0, Math.min(100, n * 100));
  return Math.max(0, Math.min(100, n));
}

export function formatPercent(input: unknown): string {
  const p = normalizePercent(input);
  if (p == null) return '—';
  return `${Math.round(p)}%`;
}
