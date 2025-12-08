// Lightweight debug utility with runtime enable.
// Enable precedence:
// 1. localStorage key 'np_debug' = 'true' forces on
// 2. localStorage key 'np_debug' = 'false' forces off
// 3. env var VITE_DEBUG_ENABLED === 'true' (fallback to DEV mode)
// Usage: debug('Tag', value1, value2)
// Output suppressed in production unless explicitly enabled.

function computeEnabled(): boolean {
  try {
    if (typeof window !== 'undefined') {
      const raw = window.localStorage.getItem('np_debug');
      if (raw === 'true') return true;
      if (raw === 'false') return false;
    }
  } catch {}
  if (import.meta.env.VITE_DEBUG_ENABLED === 'true') return true;
  return import.meta.env.DEV === true;
}

let cached = computeEnabled();
let lastCheck = Date.now();

export function debug(...args: any[]) {
  // Recompute every 5s to allow toggling without reload.
  const now = Date.now();
  if (now - lastCheck > 5000) { cached = computeEnabled(); lastCheck = now; }
  if (!cached) return;
  try { console.debug(...args); } catch {}
}

// Force toggle helper for founder tools.
export function setDebugOverride(value: boolean | null) {
  try {
    if (value === null) localStorage.removeItem('np_debug');
    else localStorage.setItem('np_debug', value ? 'true' : 'false');
    cached = computeEnabled();
  } catch {}
}

export function isDebugEnabled(): boolean { return cached; }
