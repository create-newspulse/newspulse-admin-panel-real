export function deepMerge<T extends Record<string, any>>(base: T, patch: Partial<T>): T {
  const out: any = Array.isArray(base) ? [...(base as any)] : { ...(base as any) };
  for (const [key, value] of Object.entries(patch || {})) {
    if (value === undefined) continue;
    const prev = (out as any)[key];
    if (
      prev &&
      value &&
      typeof prev === 'object' &&
      typeof value === 'object' &&
      !Array.isArray(prev) &&
      !Array.isArray(value)
    ) {
      (out as any)[key] = deepMerge(prev, value as any);
    } else {
      (out as any)[key] = value;
    }
  }
  return out as T;
}
