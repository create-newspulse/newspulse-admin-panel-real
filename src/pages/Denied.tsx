export default function Denied() {
  return (
    <div className="max-w-xl mx-auto text-center py-16">
      <div className="text-3xl font-bold mb-2">Access Denied</div>
      <p className="opacity-80">You do not have permission to open this section.</p>
      <p className="mt-2 font-semibold text-slate-700">Founder permission is required.</p>
    </div>
  );
}
