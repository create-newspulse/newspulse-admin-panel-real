// React import not required with automatic JSX runtime and no React namespace usage
import type { ReactNode } from 'react';

type Tone = 'blue' | 'green' | 'rose' | 'amber';

const TONE_BG: Record<Tone, string> = {
  blue: 'from-blue-500 to-indigo-500',
  green: 'from-emerald-500 to-green-500',
  rose: 'from-rose-500 to-pink-500',
  amber: 'from-amber-500 to-orange-500',
};

type KPIStatProps = {
  label: string;
  value: number | string;
  delta?: number | string;
  tone?: Tone;
  icon?: ReactNode;
  className?: string;
  compact?: boolean;
  ariaLabel?: string;
};

export default function KPIStat({
  label,
  value,
  delta,
  tone = 'blue',
  icon,
  className = '',
  compact = false,
  ariaLabel,
}: KPIStatProps) {
  const bg = TONE_BG[tone] ?? TONE_BG.blue;

  const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  const formatNumber = (n: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n);

  const displayValue = isNumber(value) ? formatNumber(value) : String(value);

  let deltaText: string | null = null;
  let deltaClass = 'text-slate-500';
  let deltaSymbol = '';

  if (delta !== undefined && delta !== null && delta !== '') {
    const deltaNum = typeof delta === 'string' ? Number(delta) : delta;
    const isDeltaNumber = isNumber(deltaNum);
    const positive = isDeltaNumber ? deltaNum > 0 : String(delta).trim().startsWith('+');
    const negative = isDeltaNumber ? deltaNum < 0 : String(delta).trim().startsWith('-');

    deltaSymbol = positive ? '▲' : negative ? '▼' : '';
    deltaClass = positive
      ? 'text-emerald-600 dark:text-emerald-400'
      : negative
      ? 'text-rose-600 dark:text-rose-400'
      : 'text-slate-500';

    deltaText = isDeltaNumber ? formatNumber(deltaNum) : String(delta);
  }

  return (
    <div
      className={`card hover-glow ${className}`}
      role="group"
      aria-label={
        ariaLabel ?? `${label}: ${displayValue}${deltaText ? ` (${deltaSymbol}${deltaText})` : ''}`
      }
    >
      <div className={`flex items-center justify-between ${compact ? 'py-2' : ''}`}>
        <div className={compact ? '' : 'space-y-1'}>
          <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
          <div className={`${compact ? 'text-xl' : 'text-2xl'} font-bold`}>{displayValue}</div>
          {deltaText && (
            <div className={`mt-0.5 text-xs inline-flex items-center gap-1 ${deltaClass}`}>
              <span aria-hidden>{deltaSymbol}</span>
              <span>{deltaText}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {icon ? (
            <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
              {icon}
            </div>
          ) : (
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${bg} opacity-90`} />)
          }
        </div>
      </div>
    </div>
  );
}
