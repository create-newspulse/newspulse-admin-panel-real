import React, { lazy } from "react";

/**
 * safeLazy wraps React.lazy with:
 *  - Dev-time console diagnostics (component name + original error)
 *  - Basic shape validation (ensures a default export exists)
 *  - Optional displayName assignment for React DevTools
 *
 * Usage:
 *   const Widget = safeLazy(() => import("./Widget"), "Widget");
 */
export function safeLazy<T extends React.ComponentType<any>>(
  loader: () => Promise<any>,
  displayName?: string
): React.LazyExoticComponent<T> {
  const Wrapped = lazy(async () => {
    try {
      const mod = await loader();
      if (!mod || !mod.default) {
        const msg = `safeLazy: Module loaded for ${displayName || "<anonymous>"} has no default export.`;
        if (import.meta.env.DEV) {
          console.error(msg, mod);
        }
        // Synthesize a very small component so Suspense resolves without crashing.
        const Fallback = (() => <div className="p-4 text-red-600">Missing default export</div>) as unknown as T;
        return { default: Fallback } as { default: T };
      }
      return mod as { default: T };
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error(`safeLazy: Failed to load ${displayName || "<anonymous>"}`, err);
      }
      throw err;
    }
  });
  (Wrapped as any).displayName = displayName || "SafeLazyComponent";
  return Wrapped;
}

export default safeLazy;