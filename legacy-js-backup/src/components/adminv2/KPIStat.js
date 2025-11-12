import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { memo, useMemo } from 'react';
const TONE_BG = {
    blue: 'from-blue-500 to-indigo-500',
    green: 'from-emerald-500 to-green-500',
    rose: 'from-rose-500 to-pink-500',
    amber: 'from-amber-500 to-orange-500',
};
function KPIStatComponent({ label, value, delta, tone = 'blue', icon, className = '', compact = false, ariaLabel, invert = false, format = 'number', deltaFormat = 'number', locale, numberFormatOptions, bgClassName, skeleton = false, }) {
    const bg = bgClassName ?? (TONE_BG[tone] ?? TONE_BG.blue);
    const isNumber = (v) => typeof v === 'number' && Number.isFinite(v);
    const valueFormatter = useMemo(() => {
        if (typeof format === 'function')
            return format;
        return (val) => {
            if (!isNumber(val))
                return String(val);
            const opts = format === 'currency'
                ? { style: 'currency', currency: 'USD', ...(numberFormatOptions ?? {}) }
                : format === 'percent'
                    ? { style: 'percent', maximumFractionDigits: 2, ...(numberFormatOptions ?? {}) }
                    : { maximumFractionDigits: 2, ...(numberFormatOptions ?? {}) };
            return new Intl.NumberFormat(locale, opts).format(val);
        };
    }, [format, locale, numberFormatOptions]);
    const deltaFormatter = useMemo(() => {
        if (typeof deltaFormat === 'function')
            return deltaFormat;
        return (d) => {
            if (!isNumber(d))
                return String(d);
            const opts = deltaFormat === 'percent'
                ? { style: 'percent', maximumFractionDigits: 2 }
                : { maximumFractionDigits: 2 };
            return new Intl.NumberFormat(locale, opts).format(d);
        };
    }, [deltaFormat, locale]);
    const displayValue = valueFormatter(value);
    let deltaText = null;
    let deltaClass = 'text-slate-500';
    let deltaSymbol = '';
    if (delta !== undefined && delta !== null && delta !== '') {
        const deltaNum = typeof delta === 'string' ? Number(delta) : delta;
        const isDeltaNumber = isNumber(deltaNum);
        const positive = isDeltaNumber ? deltaNum > 0 : String(delta).trim().startsWith('+');
        const negative = isDeltaNumber ? deltaNum < 0 : String(delta).trim().startsWith('-');
        deltaSymbol = positive ? 'Γû▓' : negative ? 'Γû╝' : '';
        const good = invert ? negative : positive;
        const bad = invert ? positive : negative;
        deltaClass = good
            ? 'text-emerald-600 dark:text-emerald-400'
            : bad
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-slate-500';
        deltaText = isDeltaNumber ? deltaFormatter(deltaNum) : String(delta);
    }
    return (_jsxs("div", { className: `card hover-glow ${className}`, role: "group", "aria-label": ariaLabel ?? `${label}: ${displayValue}${deltaText ? ` (${deltaSymbol}${deltaText})` : ''}`, children: [_jsxs("div", { className: `flex items-center justify-between ${compact ? 'py-2' : ''}`, children: [_jsxs("div", { className: compact ? '' : 'space-y-1', children: [_jsx("div", { className: "text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400", children: label }), _jsx("div", { className: `${compact ? 'text-xl' : 'text-2xl'} font-bold`, children: displayValue }), deltaText && (_jsxs("div", { className: `mt-0.5 text-xs inline-flex items-center gap-1 ${deltaClass}`, "aria-live": "polite", children: [_jsx("span", { "aria-hidden": true, children: deltaSymbol }), _jsx("span", { children: deltaText })] }))] }), _jsx("div", { className: "flex items-center gap-3", children: icon ? (_jsx("div", { className: "w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800", children: icon })) : (_jsx("div", { className: `w-10 h-10 rounded-xl bg-gradient-to-tr ${bg} opacity-90` })) })] }), skeleton && (_jsxs("div", { className: "mt-2 animate-pulse", children: [_jsx("div", { className: "h-2 bg-slate-200 dark:bg-slate-700 rounded w-2/5 mb-1" }), _jsx("div", { className: "h-2 bg-slate-200 dark:bg-slate-700 rounded w-1/5" })] }))] }));
}
const KPIStat = memo(KPIStatComponent);
export default KPIStat;
