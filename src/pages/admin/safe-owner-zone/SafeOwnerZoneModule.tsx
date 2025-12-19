import OwnerZoneRoute from '@/sections/SafeOwnerZone/OwnerZoneRoute';
import { OwnerModulePage } from '@/sections/SafeOwnerZone/ownerzone.registry';

const SLUG_TO_MODULE: Record<string, string> = {
  founder: 'founder',
  'security-lockdown': 'security',
  compliance: 'compliance',
  'ai-control': 'ai',
  vaults: 'vaults',
  operations: 'ops',
  revenue: 'revenue',
  'admin-oversight': 'admin',
};

export function resolveOwnerZoneModuleSlug(slug: string | undefined | null): string {
  const raw = (slug || '').trim();
  if (!raw) return 'founder';
  return SLUG_TO_MODULE[raw] || raw;
}

export default function SafeOwnerZoneModule({ slug }: { slug: string }) {
  const moduleId = resolveOwnerZoneModuleSlug(slug);
  return <OwnerModulePage moduleId={moduleId} />;
}

// Legacy compatibility for old /safeownerzone/:module routes.
// This intentionally keeps old module ids working.
export function LegacyOwnerZoneRoute() {
  return <OwnerZoneRoute />;
}
