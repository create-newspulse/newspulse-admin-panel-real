export default function PasswordStrength({ value }: { value: string }) {
  const score = [/[A-Z]/, /[a-z]/, /[0-9]/, /[^A-Za-z0-9]/].reduce((s, r) => s + (r.test(value) ? 1 : 0), 0) + (value.length >= 8 ? 1 : 0);
  const labels = ['Very weak','Weak','Okay','Good','Strong'];
  const pct = (score/5)*100;
  return (
    <div className="mt-2">
      <div className="h-2 w-full rounded bg-slate-200 dark:bg-slate-700">
        <div className="h-2 rounded bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-xs text-slate-500">{labels[Math.max(0, Math.min(4, score-1))]}</p>
    </div>
  );
}
