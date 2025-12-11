import { useAuth } from '@/context/AuthContext.tsx';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/adminApi.ts';
import { useNotify } from '@/components/ui/toast-bridge';

type CommunityFeatureToggles = {
  communityReporterEnabled: boolean;
  reporterPortalEnabled: boolean;
};

export default function FeatureTogglesCommunityReporter() {
  const { isFounder } = useAuth();
  const notify = useNotify();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['founder-feature-toggles'],
    queryFn: async (): Promise<CommunityFeatureToggles> => {
      const res = await adminApi.get('/founder/feature-toggles');
      const raw = res.data as any;
      const settings = raw.settings ?? raw;
      return {
        communityReporterEnabled: !!settings.communityReporterEnabled,
        reporterPortalEnabled: !!settings.reporterPortalEnabled,
      };
    },
  });

  const mutation = useMutation({
    mutationFn: async (partial: Partial<CommunityFeatureToggles>) => {
      const res = await adminApi.patch('/founder/feature-toggles', partial);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['founder-feature-toggles'] });
      notify.ok('Feature toggles updated');
    },
    onError: () => {
      notify.err('Failed to update feature toggles');
    },
  });

  const saving = mutation.isPending;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Community Reporter Feature Toggles</h1>
      <p className="text-sm text-slate-600">
        Founder-only switches to temporarily close Community Reporter access on the public site.
        <br />
        <strong>ON = closed / hidden, OFF = open / visible.</strong>
      </p>

      {isError && (
        <div className="p-4 border rounded border-red-300 text-red-700">
          Failed to load feature toggles.
        </div>
      )}

      {isLoading && <div className="p-4 border rounded">Loading…</div>}

      {!isLoading && data && (
        <section className="space-y-6 max-w-2xl">
          <div className="flex items-center justify-between border rounded-xl p-4">
            <div>
              <h2 className="font-semibold">Community Reporter</h2>
              <p className="text-sm text-slate-400">
                When <strong>ON</strong>, the News Pulse Community Reporter page is hidden for the public.
                When <strong>OFF</strong>, the page is visible and users can submit stories.
              </p>
            </div>
            <InlineToggleSwitch
              checked={!data.communityReporterEnabled}
              disabled={!isFounder || saving}
              onChange={(checked) =>
                mutation.mutate({ communityReporterEnabled: !checked })
              }
            />
          </div>

          <div className="flex items-center justify-between border rounded-xl p-4">
            <div>
              <h2 className="font-semibold">Reporter Portal</h2>
              <p className="text-sm text-slate-400">
                When <strong>ON</strong>, the Reporter Portal login/dashboard is hidden.
                When <strong>OFF</strong>, reporters can access the portal.
              </p>
            </div>
            <InlineToggleSwitch
              checked={!data.reporterPortalEnabled}
              disabled={!isFounder || saving}
              onChange={(checked) =>
                mutation.mutate({ reporterPortalEnabled: !checked })
              }
            />
          </div>

          {saving && <div className="text-sm text-slate-500">Saving…</div>}
        </section>
      )}
    </div>
  );
}

type ToggleProps = { checked: boolean; disabled?: boolean; onChange: (v: boolean) => void };

function InlineToggleSwitch({ checked, disabled, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => {
        if (!disabled) onChange(!checked);
      }}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      } ${checked ? 'bg-emerald-500' : 'bg-slate-300'}`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-1'
        }`}
      />
    </button>
  );
}
