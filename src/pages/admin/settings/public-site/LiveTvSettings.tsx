import { useMemo, useState } from 'react';
import Switch from '@/components/settings/Switch';
import { usePublicSiteSettingsDraft } from '@/features/settings/PublicSiteSettingsDraftContext';

function isValidEmbedUrl(raw: string): boolean {
  if (!raw) return true;
  try {
    const u = new URL(raw);
    if (!['http:', 'https:'].includes(u.protocol)) return false;
    return true;
  } catch {
    return false;
  }
}

export default function LiveTvSettings() {
  const { draft, patchDraft } = usePublicSiteSettingsDraft();
  const liveTv = useMemo(() => {
    const v = (draft as any)?.liveTv || {};
    return {
      enabled: !!v.enabled,
      embedUrl: typeof v.embedUrl === 'string' ? v.embedUrl : '',
    };
  }, [draft]);

  const [touched, setTouched] = useState(false);
  const urlOk = isValidEmbedUrl(liveTv.embedUrl);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-lg font-semibold">Live TV</div>
        <div className="mt-1 text-sm text-slate-600">Configure the Live TV embed.</div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <div className="text-sm font-semibold">Enable Live TV</div>
            <div className="text-xs text-slate-600">Turns the embed on/off on the public site.</div>
          </div>
          <Switch checked={liveTv.enabled} onCheckedChange={(v) => patchDraft({ liveTv: { enabled: v } } as any)} />
        </div>

        <label className="block rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-sm font-semibold">Embed URL</div>
          <div className="mt-1 text-xs text-slate-600">Must be a valid http(s) URL. Empty disables embed URL.</div>
          <input
            className={
              `mt-2 w-full rounded border bg-white px-3 py-2 text-sm ` +
              (!touched || urlOk ? 'border-slate-300' : 'border-red-300')
            }
            value={liveTv.embedUrl}
            onChange={(e) => {
              setTouched(true);
              patchDraft({ liveTv: { embedUrl: e.target.value } } as any);
            }}
            placeholder="https://…"
          />
          {!touched || urlOk ? null : (
            <div className="mt-2 text-xs text-red-700">Invalid URL format</div>
          )}
        </label>
      </div>
    </div>
  );
}
