export function translationUiEnabled(): boolean {
  try {
    const envAny: any = (import.meta as any)?.env || {};
    const raw = (
      envAny.VITE_TRANSLATION_UI ??
      envAny.VITE_TRANSLATION_UI_ENABLED ??
      envAny.TRANSLATION_UI ??
      envAny.TRANSLATION_UI_ENABLED ??
      '0'
    ).toString().trim();
    if (!raw) return false;
    if (raw === '0') return false;
    if (raw.toLowerCase() === 'false') return false;
    return true;
  } catch {
    return false;
  }
}
