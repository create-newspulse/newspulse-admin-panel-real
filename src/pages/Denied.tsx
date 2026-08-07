export default function Denied({ message = 'Access denied.' }: { message?: string }) {
  return (
    <div className="max-w-xl mx-auto text-center py-16">
      <div className="text-3xl font-bold mb-2">Access Denied</div>
      <p className="mt-2 font-semibold text-slate-700">{message}</p>
    </div>
  );
}
