type Props = { scope: 'frontend' | 'admin' | 'both' };

export default function ScopeBadge({ scope }: Props) {
  const styles = scope === 'frontend'
    ? 'bg-green-100 text-green-800 border-green-300'
    : scope === 'admin'
      ? 'bg-purple-100 text-purple-800 border-purple-300'
      : 'bg-blue-100 text-blue-800 border-blue-300';
  const label = scope === 'frontend' ? 'Frontend' : scope === 'admin' ? 'Admin' : 'Both';
  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded border ${styles}`}>{label}</span>
  );
}
