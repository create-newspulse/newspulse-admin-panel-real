// Utility helpers for Community Reporter admin UI
// Focus: Age group badge classification (pure function – safe for reuse)

export type AgeGroupTone = 'danger' | 'warning' | 'success' | 'neutral';

export interface AgeGroupInfo {
  label: string;
  tone: AgeGroupTone;
}

// Derive age group; explicitGroup can override (e.g. backend-provided string)
export function getAgeGroup(age?: number, explicitGroup?: string): AgeGroupInfo {
  if (explicitGroup) {
    const g = explicitGroup.toLowerCase();
    if (g.includes('under') || g.includes('child')) return { label: explicitGroup, tone: 'danger' };
    if (g.includes('youth') || g.includes('teen')) return { label: explicitGroup, tone: 'warning' };
    if (g.includes('adult') || g.includes('18')) return { label: explicitGroup, tone: 'success' };
    return { label: explicitGroup, tone: 'neutral' };
  }
  if (typeof age !== 'number' || Number.isNaN(age)) {
    return { label: 'Age not provided', tone: 'neutral' };
  }
  if (age < 13) return { label: 'Under 13 (extra caution)', tone: 'danger' };
  if (age < 18) return { label: '13–17 Youth', tone: 'warning' };
  return { label: '18+ Adult', tone: 'success' };
}

export function toneToBadgeClasses(tone: AgeGroupTone): string {
  switch (tone) {
    case 'danger': return 'bg-red-100 text-red-700 border border-red-200';
    case 'warning': return 'bg-amber-100 text-amber-700 border border-amber-200';
    case 'success': return 'bg-green-100 text-green-700 border border-green-200';
    default: return 'bg-slate-100 text-slate-600 border border-slate-200';
  }
}

export function formatLocation(location: any): string {
  if (!location) return '-';
  if (typeof location === 'string') return location.trim() || '-';
  if (typeof location === 'object') {
    const { city, state, country } = location as {
      city?: string;
      state?: string;
      country?: string;
    };
    return [city, state, country].filter(Boolean).join(', ') || '-';
  }
  return String(location);
}
