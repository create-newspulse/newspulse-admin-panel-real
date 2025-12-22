import { useSettingsDraft } from '@/features/settings/SettingsDraftContext';

export default function AdminPreview() {
  const { draft } = useSettingsDraft();

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-lg font-semibold">Preview</div>
        <div className="mt-1 text-sm text-slate-600">Preview the effective admin-panel settings payload (draft).</div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <pre className="overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-800">
          {JSON.stringify(draft ?? {}, null, 2)}
        </pre>
      </div>
    </div>
  );
}
