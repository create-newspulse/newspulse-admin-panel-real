// guardHtmlImport: detect the classic "Unexpected token '<'" HTML-as-JS failure
// Attaches a window error listener and logs a clear hint.

export function installHtmlImportGuard() {
  if (typeof window === 'undefined') return;
  if ((window as any).__htmlImportGuardInstalled) return;
  (window as any).__htmlImportGuardInstalled = true;

  window.addEventListener('error', (ev) => {
    const msg = String((ev as any).message || '');
    // Heuristic: message contains Unexpected token '<'
    if (msg.includes("Unexpected token '<'")) {
      console.error(
        '[Guard] Detected HTML served where JS was expected.\n' +
          'Common causes:\n' +
          ' - Import path typo or wrong alias (404 returns index.html)\n' +
          " - Duplicate .js/.tsx where .js shadowed TSX (now cleaned)\n" +
          ' - Dev server proxy/route returning HTML for chunk\n' +
          'Next steps: verify the failing file/line in the stack, confirm its import path exists and resolves.'
      );
    }
  });
}
