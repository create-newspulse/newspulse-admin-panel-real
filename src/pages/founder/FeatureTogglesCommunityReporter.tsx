import { useAuth } from '@/context/AuthContext.tsx';
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getFounderFeatureToggles, patchFounderFeatureToggles, type FounderFeatureToggles } from '@/lib/adminApi.ts';
import { useNotify } from '@/components/ui/toast-bridge';

// ON = closed, OFF = open
type CommunityFeatureToggles = FounderFeatureToggles;

const DEFAULT_TOGGLES: CommunityFeatureToggles = {
  communityReporterClosed: false,
  reporterPortalClosed: false,
};

type SaveState = {
  kind: 'success' | 'error';
  message: string;
};

function formatVisibilityLabel(isClosed: boolean) {
  return isClosed ? 'closed / hidden' : 'open / visible';
}

export default function FeatureTogglesCommunityReporter() {
  const { isFounder } = useAuth();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [saveState, setSaveState] = useState<SaveState | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['founder-feature-toggles'],
    queryFn: async (): Promise<CommunityFeatureToggles> => getFounderFeatureToggles(),
  });

  const currentToggles = useMemo(
    () => ({ ...DEFAULT_TOGGLES, ...(data ?? {}) }),
    [data],
  );

  const mutation = useMutation({
    mutationFn: async (partial: Partial<CommunityFeatureToggles>) => patchFounderFeatureToggles(partial),
    onSuccess: (saved, variables) => {
      queryClient.setQueryData(['founder-feature-toggles'], saved);
      queryClient.invalidateQueries({ queryKey: ['founder-feature-toggles'] });

      const changedFeature = typeof variables.communityReporterClosed === 'boolean'
        ? 'Community Reporter'
        : 'Reporter Portal';
      const changedValue = typeof variables.communityReporterClosed === 'boolean'
        ? saved.communityReporterClosed
        : saved.reporterPortalClosed;
      const message = `${changedFeature} saved as ${formatVisibilityLabel(changedValue)}.`;

      setSaveState({ kind: 'success', message });
      notify.ok(message);
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || error?.message || 'Failed to update feature toggles.';
      setSaveState({ kind: 'error', message });
      notify.err(message);
    },
  });

  const saving = mutation.isPending;

  const handleToggleChange = (nextPatch: Partial<CommunityFeatureToggles>) => {
    setSaveState(null);
    mutation.mutate({
      ...currentToggles,
      ...nextPatch,
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Community Reporter Feature Toggles</h1>
      <p className="text-sm text-slate-600">
        Founder-only switches for the live Community Reporter experience.
        <br />
        <strong>ON = closed / hidden, OFF = open / visible.</strong>
      </p>

      {saveState && (
        <div className={`p-4 border rounded ${saveState.kind === 'success' ? 'border-emerald-300 text-emerald-700 bg-emerald-50' : 'border-red-300 text-red-700 bg-red-50'}`}>
          {saveState.message}
          {saveState.kind === 'success' && currentToggles.updatedAt ? (
            <span className="ml-2 text-xs text-current/80">Updated {new Date(currentToggles.updatedAt).toLocaleString()}.</span>
          ) : null}
        </div>
      )}

      {isError && (
        <div className="p-4 border rounded border-red-300 text-red-700">
          {(() => {
            const status = (error as any)?.response?.status ?? (error as any)?.status;
            const message = (error as any)?.response?.data?.message || (error as any)?.response?.data?.error || (error as any)?.message;
            if (message) return `Failed to load feature toggles: ${message}${status ? ` (HTTP ${status})` : ''}`;
            return `Failed to load feature toggles${status ? ` (HTTP ${status})` : ''}.`;
          })()}
        </div>
      )}

      {isLoading && <div className="p-4 border rounded">Loading…</div>}

      {!isLoading && data && (
        <section className="space-y-6 max-w-2xl">
          <div className="flex items-center justify-between border rounded-xl p-4">
            <div>
              <h2 className="font-semibold">Community Reporter</h2>
              <p className="text-sm text-slate-400">
                When <strong>ON</strong>, the public Community Reporter submission entry is hidden.
                When <strong>OFF</strong>, it stays open so reporters can start new submissions.
              </p>
            </div>
            <InlineToggleSwitch
              checked={currentToggles.communityReporterClosed}
              disabled={!isFounder || saving}
              onChange={(checked) => handleToggleChange({ communityReporterClosed: checked })}
            />
          </div>

          <div className="flex items-center justify-between border rounded-xl p-4">
            <div>
              <h2 className="font-semibold">Reporter Portal</h2>
              <p className="text-sm text-slate-400">
                When <strong>ON</strong>, the live Reporter Portal is hidden and closed for reporters.
                When <strong>OFF</strong>, reporters can see the portal, access their dashboard, and track their own stories.
              </p>
            </div>
            <InlineToggleSwitch
              checked={currentToggles.reporterPortalClosed}
              disabled={!isFounder || saving}
              onChange={(checked) => handleToggleChange({ reporterPortalClosed: checked })}
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
