import { useAuth } from '@/context/AuthContext.tsx';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/adminApi.ts';
import { useNotify } from '@/components/ui/toast-bridge';

// Shape of settings we care about on this page
type CommunityFeatureToggles = {
  communityReporterEnabled: boolean;
  reporterPortalEnabled: boolean;
};

type FeatureTogglesResponse = {
  ok?: boolean;
  success?: boolean;
  settings: CommunityFeatureToggles;
};

export default function FeatureTogglesCommunityReporter() {
  const { isFounder } = useAuth(); // still available for info text if you want
  const notify = useNotify();
  const queryClient = useQueryClient();

  // ---- LOAD CURRENT SETTINGS ----
  const {
    data: settings,
    isLoading,
    isError,
    isFetching,
  } = useQuery<CommunityFeatureToggles>({
    queryKey: ['founder-feature-toggles'],
    queryFn: async () => {
      const res = await adminApi.get<FeatureTogglesResponse>('/founder/feature-toggles');
      return res.data.settings;
    },
  });

  // ---- UPDATE SETTINGS (PATCH) ----
  const mutation = useMutation({
    mutationFn: async (partial: Partial<CommunityFeatureToggles>) => {
      const res = await adminApi.patch<FeatureTogglesResponse>('/founder/feature-toggles', partial);
      return res.data.settings;
    },
    onSuccess: (newSettings) => {
      // update cache so UI reflects the latest state immediately
      queryClient.setQueryData<CommunityFeatureToggles>(
        ['founder-feature-toggles'],
        newSettings,
      );
      notify.ok('Feature toggles updated');
    },
    onError: () => {
      notify.err('Failed to update feature toggles');
    },
  });

  const disabled = isLoading || isFetching || mutation.isPending;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Community Reporter Feature Toggles</h1>
      <p className="text-sm text-slate-600">
        Founder-only switches to open/close Community Reporter program.
      </p>

      {isError && (
        <div className="p-4 border rounded border-red-300 text-red-700">
          Failed to load feature toggles.
        </div>
      )}

      {isLoading && (
        <div className="p-4 border rounded">
          Loading…
        </div>
      )}

      {!isLoading && settings && (
        <section className="space-y-6 max-w-2xl">
          {/* Community Reporter toggle */}
          <div className="flex items-center justify-between border rounded-xl bg-white px-6 py-4">
            <div>
              <h2 className="font-semibold">Community Reporter</h2>
              <p className="text-sm text-slate-500">
                Public can submit stories from the live site.
              </p>
            </div>
            <InlineToggleSwitch
              checked={!!settings.communityReporterEnabled}
              disabled={disabled}
              onChange={(checked) =>
                mutation.mutate({ communityReporterEnabled: checked })
              }
            />
          </div>

          {/* Reporter Portal toggle */}
          <div className="flex items-center justify-between border rounded-xl bg-white px-6 py-4">
            <div>
              <h2 className="font-semibold">Reporter Portal</h2>
              <p className="text-sm text-slate-500">
                Reporter login &amp; dashboard access.
              </p>
            </div>
            <InlineToggleSwitch
              checked={!!settings.reporterPortalEnabled}
              disabled={disabled}
              onChange={(checked) =>
                mutation.mutate({ reporterPortalEnabled: checked })
              }
            />
          </div>

          {mutation.isPending && (
            <div className="text-sm text-slate-500">Saving…</div>
          )}

          {!mutation.isPending && isFounder === false && (
            <div className="text-xs text-slate-500">
              Note: Backend will still enforce founder-only access. If you are not the founder,
              these changes may be rejected.
            </div>
          )}
        </section>
      )}
    </div>
  );
}

type ToggleProps = {
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
};

function InlineToggleSwitch({ checked, disabled, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      aria-disabled={disabled}
      onClick={() => {
        if (!disabled) onChange(!checked);
      }}
      className={[
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
        checked ? 'bg-emerald-500' : 'bg-slate-300',
      ].join(' ')}
    >
      <span
        className={[
          'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-5' : 'translate-x-1',
        ].join(' ')}
      />
    </button>
  );
}
