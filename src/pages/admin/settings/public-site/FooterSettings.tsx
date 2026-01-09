import { useMemo } from 'react';
import Switch from '@/components/settings/Switch';
import { usePublicSiteSettingsDraft } from '@/features/settings/PublicSiteSettingsDraftContext';

export default function FooterSettings() {
  const { draft, patchDraft } = usePublicSiteSettingsDraft();

  const footer = useMemo(() => {
    const f = (draft as any)?.footer || {};
    const modules = (draft as any)?.homepage?.modules || {};
    return {
      enabled: !!((modules as any)?.footer?.enabled ?? (draft as any)?.ui?.showFooter),
      text: typeof f.text === 'string' ? f.text : '',
    };
  }, [draft]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-lg font-semibold">Footer</div>
        <div className="mt-1 text-sm text-slate-600">Control footer visibility and content.</div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <div className="text-sm font-semibold">Show Footer</div>
            <div className="text-xs text-slate-600">Turns footer on/off on the public site.</div>
          </div>
          <Switch checked={footer.enabled} onCheckedChange={(v) => patchDraft({ homepage: { modules: { footer: { enabled: v } } } } as any)} />
        </div>

        <label className="block rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-sm font-semibold">Footer text</div>
          <div className="mt-1 text-xs text-slate-600">Optional short text displayed in the footer.</div>
          <input
            className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
            value={footer.text}
            onChange={(e) => patchDraft({ footer: { text: e.target.value } } as any)}
            placeholder="© NewsPulse"
          />
        </label>
      </div>
    </div>
  );
}
