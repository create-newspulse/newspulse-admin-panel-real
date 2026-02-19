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
